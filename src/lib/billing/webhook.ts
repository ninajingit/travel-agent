import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  conciergePasses,
  stripeEvents,
  subscriptions,
  users,
} from "@/db/schema";
import { LOOKUP_KEYS } from "./catalog";
import { stripe } from "./stripe";

// Keys the checkout route writes onto Checkout Sessions and subscriptions so
// the webhook can find the person a Stripe object belongs to. Stripe's own
// customer id is the usual link, but it is not there on the very first event.
export const METADATA = {
  userId: "mira_user_id",
  tripId: "mira_trip_id",
} as const;

/**
 * Take ownership of an event before doing any work.
 *
 * Returns false when this event has already been handled to completion, which
 * is how a redelivery becomes a no-op. An event whose handler threw last time
 * leaves processed_at null, so Stripe's retry is allowed through rather than
 * being swallowed as a duplicate.
 *
 * The neon-http driver has no transactions, so this is an insert followed by a
 * read rather than one atomic step. Two simultaneous deliveries of the same
 * event could both get through; the handlers below are written so that doing
 * the work twice lands on the same result.
 */
export async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });

  if (inserted.length > 0) return true;

  const [seen] = await db
    .select({ processedAt: stripeEvents.processedAt })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id))
    .limit(1);

  return seen ? seen.processedAt === null : true;
}

export async function markProcessed(eventId: string) {
  await db
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvents.id, eventId));
}

function planFor(lookupKey: string | null | undefined) {
  if (lookupKey === LOOKUP_KEYS.plus) return "plus" as const;
  if (lookupKey === LOOKUP_KEYS.pro) return "pro" as const;
  return null;
}

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function userIdFrom(metadata: Stripe.Metadata | null | undefined) {
  const raw = metadata?.[METADATA.userId];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

/** The person a Stripe object belongs to, by customer id or by metadata. */
async function findUser(
  customerId: string | null,
  metadata: Stripe.Metadata | null | undefined,
) {
  if (customerId) {
    const [byCustomer] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    if (byCustomer) return byCustomer;
  }

  const userId = userIdFrom(metadata);
  if (userId === null) return null;

  const [byMetadata] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return byMetadata ?? null;
}

/**
 * Write a Stripe subscription into the mirror.
 *
 * Does nothing when the subscription is not one of ours, or when the person
 * cannot be identified yet. The second case is normal: subscription.created
 * can arrive before checkout.session.completed has linked the customer to a
 * user, and the checkout handler re-reads the subscription afterwards, so the
 * mirror converges whichever order the two events land in.
 */
export async function upsertSubscription(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  if (!item) return;

  const plan = planFor(item.price.lookup_key);
  if (!plan) return;

  const user = await findUser(
    idOf(subscription.customer),
    subscription.metadata,
  );
  if (!user) return;

  const values = {
    userId: user.id,
    stripeSubscriptionId: subscription.id,
    plan,
    status: subscription.status,
    priceLookupKey: item.price.lookup_key ?? "",
    // Item-level since 2025-03-31.basil; Mira sells one item per subscription.
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date(),
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: values,
    });

  // Stripe will happily give the same person a second trial on a second
  // subscription, so the app remembers that they have had one. Never cleared.
  if (subscription.status === "trialing" && user.trialUsedAt === null) {
    await db
      .update(users)
      .set({ trialUsedAt: new Date() })
      .where(eq(users.id, user.id));
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = idOf(session.customer);
  const user = await findUser(customerId, session.metadata);
  if (!user) return;

  // First purchase: remember which Stripe customer is this person, so later
  // events can be resolved without metadata.
  if (customerId && user.stripeCustomerId !== customerId) {
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, user.id));
  }

  if (session.mode === "subscription") {
    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) return;
    // Re-read rather than trust the summary on the session, and so that a
    // subscription.created that arrived before the customer was linked gets
    // written now.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertSubscription(subscription);
    return;
  }

  if (session.mode === "payment") {
    const tripId = Number(session.metadata?.[METADATA.tripId]);
    if (!Number.isInteger(tripId)) return;

    // Unique on the session id, so a redelivery cannot grant a second pass.
    await db
      .insert(conciergePasses)
      .values({
        userId: user.id,
        tripId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: idOf(session.payment_intent),
        // What Checkout reported. With Adaptive Pricing this is not always USD.
        amountCents: session.amount_total ?? 0,
        currency: (session.currency ?? "usd").toUpperCase(),
      })
      .onConflictDoNothing();
  }
}

/** The subscription an invoice belongs to, across API version shapes. */
function subscriptionIdOnInvoice(invoice: Stripe.Invoice): string | null {
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } };
      subscription?: string | { id: string };
    }
  );
  return (
    idOf(parent.parent?.subscription_details?.subscription) ??
    idOf(parent.subscription)
  );
}

/**
 * Invoice events do not carry subscription state, and Stripe sends a
 * subscription.updated alongside them anyway. Re-reading the subscription here
 * is belt and braces: whichever event arrives last, the mirror ends up right.
 */
async function handleInvoice(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOnInvoice(invoice);
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscription(subscription);
}

/** Does the work for one event. Throwing here makes the route answer 500 and
 * Stripe retry, which is what we want for a database or network blip. */
export async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      return;

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.trial_will_end":
      await upsertSubscription(event.data.object);
      return;

    case "invoice.paid":
    case "invoice.payment_failed":
      await handleInvoice(event.data.object);
      return;

    default:
      // Registered for fewer events than Stripe can send. Anything else is
      // recorded in stripe_events and otherwise ignored on purpose.
      return;
  }
}

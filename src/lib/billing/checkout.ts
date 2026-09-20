import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { priceIdFor, type CatalogKey } from "./catalog";
import { stripe } from "./stripe";
import { METADATA } from "./webhook";

type User = typeof users.$inferSelect;

/**
 * Where Stripe sends people back to.
 *
 * Configured rather than taken from the request's Origin header, which a
 * caller controls: success_url is a redirect we hand to Stripe, and it should
 * not be something a visitor can point at their own site.
 */
export function appBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * The Stripe customer for this person, made on first need.
 *
 * Nobody gets a customer at sign-up; someone who never pays never appears in
 * Stripe. Two simultaneous first checkouts could make two customers, which
 * costs a stray empty record and nothing else.
 */
export async function getOrCreateCustomer(user: User) {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { [METADATA.userId]: String(user.id) },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, user.id));

  return customer.id;
}

/** Ten days of Pro before the first charge, once per person. */
export const TRIAL_DAYS = 10;

/**
 * The trial is the reason to pick Pro, and it is offered once.
 *
 * Stripe will happily start a second trial on a second subscription, so
 * eligibility is the app's own record, set by the webhook the first time a
 * trialing subscription is seen and never cleared.
 */
export function trialAvailable(user: User, offer: "plus" | "pro") {
  return offer === "pro" && user.trialUsedAt === null;
}

/** Hosted Checkout for a membership. */
export async function membershipCheckout(user: User, offer: "plus" | "pro") {
  const customer = await getOrCreateCustomer(user);
  const base = appBaseUrl();
  const metadata = { [METADATA.userId]: String(user.id) };

  return stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: await priceIdFor(offer), quantity: 1 }],
    success_url: `${base}/app/membership?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing?checkout=cancelled`,
    client_reference_id: String(user.id),
    metadata,
    // Also on the subscription, so the webhook can find the person even when
    // subscription.created arrives before the session is completed.
    subscription_data: {
      metadata,
      // Stripe runs the clock. The card is still collected at Checkout, so
      // the trial converts on its own unless it is cancelled first.
      ...(trialAvailable(user, offer) ? { trial_period_days: TRIAL_DAYS } : {}),
    },
  });
}

/** Hosted Checkout for one Concierge Pass on one trip. */
export async function passCheckout(user: User, tripId: number) {
  const customer = await getOrCreateCustomer(user);
  const base = appBaseUrl();
  const metadata = {
    [METADATA.userId]: String(user.id),
    [METADATA.tripId]: String(tripId),
  };

  return stripe().checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ price: await priceIdFor("pass" as CatalogKey), quantity: 1 }],
    success_url: `${base}/app/trips/${tripId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/trips/${tripId}?checkout=cancelled`,
    metadata,
    payment_intent_data: { metadata },
  });
}

/** The Customer Portal, for changing or fixing a subscription. */
export async function portalSession(user: User, returnPath = "/app") {
  const customer = await getOrCreateCustomer(user);
  return stripe().billingPortal.sessions.create({
    customer,
    return_url: `${appBaseUrl()}${returnPath}`,
  });
}

// Proves the webhook's idempotency against the real dev database, without
// needing the Stripe CLI. It builds events by hand, runs them through the same
// handlers the route uses, and cleans up after itself.
//
//   npm run stripe:webhook-check
//
// The signature check is not exercised here; `stripe listen` plus
// `stripe trigger` covers that once the CLI is installed.
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stripeEvents, subscriptions, users } from "@/db/schema";
import { LOOKUP_KEYS } from "@/lib/billing/catalog";
import { METADATA, claimEvent, handleEvent, markProcessed } from "@/lib/billing/webhook";

const suffix = Math.random().toString(36).slice(2, 10);
const SUB_ID = `sub_check_${suffix}`;
const CUSTOMER_ID = `cus_check_${suffix}`;

function subscriptionEvent(
  eventId: string,
  userId: number,
  status: Stripe.Subscription.Status,
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);
  const subscription = {
    id: SUB_ID,
    object: "subscription",
    customer: CUSTOMER_ID,
    status,
    cancel_at_period_end: false,
    trial_end: status === "trialing" ? now + 10 * 86_400 : null,
    metadata: { [METADATA.userId]: String(userId) },
    items: {
      object: "list",
      data: [
        {
          id: `si_${suffix}`,
          object: "subscription_item",
          current_period_start: now,
          current_period_end: now + 30 * 86_400,
          price: { id: "price_check", lookup_key: LOOKUP_KEYS.pro },
        },
      ],
    },
  };
  return {
    id: eventId,
    object: "event",
    type: "customer.subscription.created",
    data: { object: subscription },
  } as unknown as Stripe.Event;
}

async function mirrorRows() {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, SUB_ID));
}

/** Runs one event the way the route does. Returns false if it was a duplicate. */
async function deliver(event: Stripe.Event) {
  if (!(await claimEvent(event))) return false;
  await handleEvent(event);
  await markProcessed(event.id);
  return true;
}

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error("No users in this database. Sign in once first.");
  console.log(`user          ${user.id}  ${user.email}`);
  const trialBefore = user.trialUsedAt;
  const eventA = `evt_check_${suffix}_a`;
  const eventB = `evt_check_${suffix}_b`;

  try {
    check("first delivery is accepted", await deliver(subscriptionEvent(eventA, user.id, "trialing")));

    const afterFirst = await mirrorRows();
    check("one subscription row written", afterFirst.length === 1);
    check("plan resolved from the lookup key", afterFirst[0]?.plan === "pro");
    check("status mirrored", afterFirst[0]?.status === "trialing");
    check("period bounds read from the item", afterFirst[0]?.currentPeriodEnd > new Date());

    const [afterTrial] = await db.select().from(users).where(eq(users.id, user.id));
    check("trial recorded against the person", afterTrial?.trialUsedAt !== null);

    // Same event id, different contents: still a duplicate. Dedupe is by
    // Stripe's event id, which is what a redelivery reuses.
    const replay = subscriptionEvent(eventA, user.id, "active");
    check("redelivery is refused", (await deliver(replay)) === false);

    const afterReplay = await mirrorRows();
    check("redelivery changed nothing", afterReplay[0]?.status === "trialing");
    check("redelivery added no row", afterReplay.length === 1);

    // A genuinely new event does update the same row rather than adding one.
    check("new event is accepted", await deliver(subscriptionEvent(eventB, user.id, "active")));
    const afterUpdate = await mirrorRows();
    check("update applied in place", afterUpdate[0]?.status === "active");
    check("still one row", afterUpdate.length === 1);
  } finally {
    await db.delete(subscriptions).where(eq(subscriptions.stripeSubscriptionId, SUB_ID));
    await db.delete(stripeEvents).where(eq(stripeEvents.id, eventA));
    await db.delete(stripeEvents).where(eq(stripeEvents.id, eventB));
    await db.update(users).set({ trialUsedAt: trialBefore }).where(eq(users.id, user.id));
    console.log("cleaned up");
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

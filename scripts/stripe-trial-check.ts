// Proves the ten-day Pro trial end to end against the sandbox: that Checkout
// asks for it, that a trialing subscription grants Pro, and that the same
// person cannot have a second one. Creates a throwaway user, customer, and
// subscription, and removes all three.
//
//   npm run stripe:trial-check
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { priceIdFor } from "@/lib/billing/catalog";
import { TRIAL_DAYS, membershipCheckout } from "@/lib/billing/checkout";
import { getEntitlement } from "@/lib/billing/entitlement";
import { stripe } from "@/lib/billing/stripe";
import { upsertSubscription } from "@/lib/billing/webhook";

const tag = Math.random().toString(36).slice(2, 10);

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `trial_${tag}`, email: `trial_${tag}@example.test`, name: "Trial" })
    .returning();

  let subscriptionId: string | null = null;
  let customerId: string | null = null;

  try {
    // What Checkout will actually charge today is the observable fact.
    // `subscription_data` is a create-only parameter and is not on the
    // retrieved Session, so asserting on it silently reads undefined and
    // passes whatever happens. A trial bills nothing now; no trial bills the
    // full price now.
    const first = await membershipCheckout(user, "pro");
    customerId = String(first.customer);
    const opened = await stripe().checkout.sessions.retrieve(first.id);
    check(`a trial checkout charges nothing today`, opened.amount_total === 0);
    // The card is still collected: a trial that cannot convert is a giveaway.
    check("a card is still required", opened.payment_method_collection !== "if_required");
    await stripe().checkout.sessions.expire(first.id);

    // Plus never carries one; the trial is the reason to pick Pro.
    const plus = await membershipCheckout(user, "plus");
    const plusOpened = await stripe().checkout.sessions.retrieve(plus.id);
    check("plus charges $29 today, so it has no trial", plusOpened.amount_total === 2900);
    await stripe().checkout.sessions.expire(plus.id);

    // A real trialing subscription, the way Checkout would leave one.
    const subscription = await stripe().subscriptions.create({
      customer: customerId,
      items: [{ price: await priceIdFor("pro") }],
      trial_period_days: TRIAL_DAYS,
      metadata: { mira_user_id: String(user.id) },
    });
    subscriptionId = subscription.id;
    check("stripe reports it trialing", subscription.status === "trialing");

    await upsertSubscription(subscription);
    const entitlement = await getEntitlement(user.id);
    check("trialing grants Pro", entitlement.plan === "pro");
    check("status mirrored as trialing", entitlement.status === "trialing");
    check("Pro allowance during the trial", entitlement.actionsAllowed === 50);

    const daysToCharge = entitlement.trialEnd
      ? Math.round((entitlement.trialEnd.getTime() - Date.now()) / 86_400_000)
      : -1;
    check(`first charge is ${TRIAL_DAYS} days out`, daysToCharge === TRIAL_DAYS);

    const [afterTrial] = await db.select().from(users).where(eq(users.id, user.id));
    check("the trial is recorded against the person", afterTrial.trialUsedAt !== null);

    // Second time around, Stripe would give another trial. The app does not.
    const second = await membershipCheckout(afterTrial, "pro");
    const secondOpened = await stripe().checkout.sessions.retrieve(second.id);
    check(
      "a second checkout charges $99 today, so the trial is refused",
      secondOpened.amount_total === 9900,
    );
    await stripe().checkout.sessions.expire(second.id);
  } finally {
    if (subscriptionId) await stripe().subscriptions.cancel(subscriptionId);
    if (customerId) await stripe().customers.del(customerId);
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
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

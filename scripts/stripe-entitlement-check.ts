// Drives getEntitlement through the free, plus, pro, and pass cases against a
// throwaway user, then deletes everything it made.
//
//   npm run stripe:entitlement-check
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  agentTransactions,
  conciergePasses,
  destinations,
  subscriptions,
  trips,
  users,
} from "@/db/schema";
import {
  canAutoRebook,
  canBook,
  getEntitlement,
  hasPass,
} from "@/lib/billing/entitlement";

const tag = Math.random().toString(36).slice(2, 10);

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

function day(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `check_${tag}`, email: `check_${tag}@example.test`, name: "Check" })
    .returning();
  const [place] = await db
    .insert(destinations)
    .values({ userId: user.id, name: "Lisbon", country: "Portugal" })
    .returning();
  // One trip that is still running, one that is over.
  const [trip] = await db
    .insert(trips)
    .values({ userId: user.id, destinationId: place.id, startsAt: day(-1), endsAt: day(9) })
    .returning();
  const [otherTrip] = await db
    .insert(trips)
    .values({ userId: user.id, destinationId: place.id, startsAt: day(-20), endsAt: day(-10) })
    .returning();

  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - 5);
  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 25);

  async function setPlan(plan: "plus" | "pro", status = "active") {
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.insert(subscriptions).values({
      userId: user.id,
      stripeSubscriptionId: `sub_check_${tag}_${plan}`,
      plan,
      status,
      priceLookupKey: `${plan}_monthly`,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
  }

  try {
    // Free
    let e = await getEntitlement(user.id);
    check("free: plan is free", e.plan === "free");
    check("free: no allowance", e.actionsAllowed === 0 && e.actionsLeft === 0);
    check("free: falls back to a calendar period", e.hasBillingPeriod === false);
    check("free: cannot book", canBook(e, trip.id) === false);
    check("free: no auto-rebook", canAutoRebook(e, trip.id) === false);

    // Plus
    await setPlan("plus");
    e = await getEntitlement(user.id);
    check("plus: plan is plus", e.plan === "plus");
    check("plus: ten actions", e.actionsAllowed === 10 && e.actionsLeft === 10);
    check("plus: period comes from the subscription", e.hasBillingPeriod === true);
    check("plus: can book", canBook(e, trip.id) === true);
    check("plus: no auto-rebook", canAutoRebook(e, trip.id) === false);

    // Actions count against the allowance.
    await db.insert(agentTransactions).values([
      { userId: user.id, tripId: trip.id, kind: "booking", amountCents: 1000, description: "a" },
      { userId: user.id, tripId: null, kind: "booking", amountCents: 1000, description: "b" },
    ]);
    e = await getEntitlement(user.id);
    check("plus: two actions counted", e.actionsUsed === 2 && e.actionsLeft === 8);

    // An action outside the period is not counted.
    const old = new Date(periodStart);
    old.setUTCDate(old.getUTCDate() - 10);
    await db.insert(agentTransactions).values({
      userId: user.id, tripId: null, kind: "booking", amountCents: 1000,
      description: "old", occurredAt: old,
    });
    e = await getEntitlement(user.id);
    check("plus: last period's action is not counted", e.actionsUsed === 2);

    // Pass on the live trip.
    await db.insert(conciergePasses).values({
      userId: user.id, tripId: trip.id,
      stripeCheckoutSessionId: `cs_check_${tag}`,
      amountCents: 15000, currency: "USD",
      purchasedAt: periodStart,
    });
    e = await getEntitlement(user.id);
    check("pass: listed on the entitlement", e.passes.length === 1 && hasPass(e, trip.id));
    check("pass: its trip's action stops counting", e.actionsUsed === 1);
    check("pass: other trips still count", e.actionsLeft === 9);
    check("pass: grants auto-rebook on that trip", canAutoRebook(e, trip.id) === true);
    check("pass: not on another trip", canAutoRebook(e, otherTrip.id) === false);

    // Pro
    await setPlan("pro");
    e = await getEntitlement(user.id);
    check("pro: fifty actions", e.actionsAllowed === 50);
    check("pro: auto-rebook anywhere", canAutoRebook(e, otherTrip.id) === true);

    // past_due keeps access (D9).
    await setPlan("pro", "past_due");
    e = await getEntitlement(user.id);
    check("past_due: still Pro", e.plan === "pro" && e.pastDue === true);
    check("past_due: can still book", canBook(e, trip.id) === true);

    // A free user with a pass can still act on the covered trip.
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    e = await getEntitlement(user.id);
    check("free with a pass: can book that trip", canBook(e, trip.id) === true);
    check("free with a pass: cannot book another", canBook(e, otherTrip.id) === false);
  } finally {
    await db.delete(agentTransactions).where(eq(agentTransactions.userId, user.id));
    await db.delete(conciergePasses).where(eq(conciergePasses.userId, user.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(trips).where(eq(trips.userId, user.id));
    await db.delete(destinations).where(eq(destinations.userId, user.id));
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

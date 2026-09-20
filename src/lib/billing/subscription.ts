import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";

// Stripe status strings, split by what they mean to us.
//
// `past_due` still grants access: Stripe is retrying the card and a banner
// asks for a new one, rather than the product going dark mid-trip (D9).
// `unpaid` means the retries are exhausted, so access stops, but the person
// still has a subscription and belongs in the Customer Portal rather than at
// a fresh checkout. `incomplete` is a checkout that never finished paying;
// Stripe expires it on its own, and it must not block a second attempt.
export const ACCESS_STATUSES = ["trialing", "active", "past_due"] as const;
export const BLOCKING_STATUSES = [...ACCESS_STATUSES, "unpaid"] as const;

/** The subscription that decides what this person can do, if any. */
export async function accessSubscription(userId: number) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...ACCESS_STATUSES]),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);
  return row ?? null;
}

/** Any subscription that means "manage the one you have" rather than "buy". */
export async function blockingSubscription(userId: number) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...BLOCKING_STATUSES]),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);
  return row ?? null;
}

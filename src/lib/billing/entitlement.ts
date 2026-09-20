import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { agentTransactions, conciergePasses, trips } from "@/db/schema";
import { monthBounds } from "@/db/queries/agent-transactions";
import { accessSubscription } from "./subscription";

export type Plan = "free" | "plus" | "pro";

// Agent actions included per billing period. An action is a row in
// agent_transactions: a booking, a rebooking, or a cancellation. Planning and
// watching are never counted.
export const ALLOWANCE: Record<Plan, number> = { free: 0, plus: 10, pro: 50 };

export type Pass = {
  tripId: number;
  purchasedAt: Date;
  coversUntil: string;
  amountCents: number;
  currency: string;
};

export type Entitlement = {
  plan: Plan;
  /** Stripe's status word, or null on Free. */
  status: string | null;
  /** Bounds the allowance is counted over. Free falls back to the calendar
   * month so the Activity page has something coherent to show. */
  periodStart: Date;
  periodEnd: Date;
  /** True when the period came from a subscription rather than the calendar. */
  hasBillingPeriod: boolean;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  pastDue: boolean;
  actionsUsed: number;
  actionsAllowed: number;
  actionsLeft: number;
  passes: Pass[];
};

/** Is this trip covered by a pass right now? A pass grants Pro for one trip. */
export function hasPass(entitlement: Entitlement, tripId: number) {
  return entitlement.passes.some((pass) => pass.tripId === tripId);
}

/** May Mira book on this trip? Free cannot, unless the trip has a pass. */
export function canBook(entitlement: Entitlement, tripId: number | null) {
  if (entitlement.plan !== "free") return entitlement.actionsLeft > 0;
  return tripId !== null && hasPass(entitlement, tripId);
}

/** May Mira rebook without being asked? Pro, or a pass on that trip. */
export function canAutoRebook(entitlement: Entitlement, tripId: number | null) {
  if (entitlement.plan === "pro") return true;
  return tripId !== null && hasPass(entitlement, tripId);
}

/** The end of the day a trip finishes, in UTC. trips.ends_at is a calendar date. */
function endOfTripDay(endsAt: string) {
  return new Date(`${endsAt}T23:59:59.999Z`);
}

/**
 * Everything the app needs to know about what a person may do.
 *
 * The only place that answers plan questions. Chat, rebook, settings,
 * activity, the membership page, and pricing all ask this and nothing else.
 * Reads the local mirror, never Stripe, so a page render is one query.
 */
export async function getEntitlement(userId: number): Promise<Entitlement> {
  const subscription = await accessSubscription(userId);
  const plan: Plan = subscription?.plan ?? "free";

  const now = new Date();
  const fallback = monthBounds(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const periodStart = subscription?.currentPeriodStart ?? fallback.start;
  const periodEnd = subscription?.currentPeriodEnd ?? fallback.end;

  const passRows = await db
    .select({
      tripId: conciergePasses.tripId,
      purchasedAt: conciergePasses.purchasedAt,
      amountCents: conciergePasses.amountCents,
      currency: conciergePasses.currency,
      endsAt: trips.endsAt,
    })
    .from(conciergePasses)
    .innerJoin(trips, eq(conciergePasses.tripId, trips.id))
    .where(eq(conciergePasses.userId, userId));

  // Coverage runs from purchase to the trip's end date as it stands now, so a
  // trip that gets extended stays covered (D20).
  const passes: Pass[] = passRows
    .filter((row) => endOfTripDay(row.endsAt) >= now)
    .map((row) => ({
      tripId: row.tripId,
      purchasedAt: row.purchasedAt,
      coversUntil: row.endsAt,
      amountCents: row.amountCents,
      currency: row.currency,
    }));

  const actions = await db
    .select({
      tripId: agentTransactions.tripId,
      occurredAt: agentTransactions.occurredAt,
    })
    .from(agentTransactions)
    .where(
      and(
        eq(agentTransactions.userId, userId),
        gte(agentTransactions.occurredAt, periodStart),
        lt(agentTransactions.occurredAt, periodEnd),
      ),
    );

  // Actions on a pass-covered trip never count against a membership
  // allowance (D5). "Covered" means after the pass was bought and before the
  // trip ended, so a pass does not retroactively pay for earlier actions.
  const coverage = new Map(
    passRows.map((row) => [
      row.tripId,
      { from: row.purchasedAt, to: endOfTripDay(row.endsAt) },
    ]),
  );
  const actionsUsed = actions.filter((action) => {
    if (action.tripId === null) return true;
    const window = coverage.get(action.tripId);
    if (!window) return true;
    return action.occurredAt < window.from || action.occurredAt > window.to;
  }).length;

  const actionsAllowed = ALLOWANCE[plan];

  return {
    plan,
    status: subscription?.status ?? null,
    periodStart,
    periodEnd,
    hasBillingPeriod: subscription !== null,
    trialEnd: subscription?.trialEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    pastDue: subscription?.status === "past_due",
    actionsUsed,
    actionsAllowed,
    actionsLeft: Math.max(0, actionsAllowed - actionsUsed),
    passes,
  };
}

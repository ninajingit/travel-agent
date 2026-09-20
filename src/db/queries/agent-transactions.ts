import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { agentTransactions, destinations, trips } from "@/db/schema";

// A calendar month in UTC: [start, end).
export function monthBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

// Everything the agent did with money for this person in one month, newest
// first, with the trip's destination when there is one.
export function listTransactionsForMonth(userId: number, year: number, month: number) {
  const { start, end } = monthBounds(year, month);
  return listTransactionsBetween(userId, start, end);
}

// The same, over any window: a billing period rather than a calendar month.
// [start, end).
export function listTransactionsBetween(userId: number, start: Date, end: Date) {
  return db
    .select({
      id: agentTransactions.id,
      kind: agentTransactions.kind,
      amountCents: agentTransactions.amountCents,
      currency: agentTransactions.currency,
      description: agentTransactions.description,
      occurredAt: agentTransactions.occurredAt,
      tripId: agentTransactions.tripId,
      stripePaymentIntentId: agentTransactions.stripePaymentIntentId,
      cancelledBy: agentTransactions.cancelledBy,
      destination: destinations.name,
    })
    .from(agentTransactions)
    .leftJoin(trips, eq(trips.id, agentTransactions.tripId))
    .leftJoin(destinations, eq(destinations.id, trips.destinationId))
    .where(
      and(
        eq(agentTransactions.userId, userId),
        gte(agentTransactions.occurredAt, start),
        lt(agentTransactions.occurredAt, end),
      ),
    )
    .orderBy(desc(agentTransactions.occurredAt));
}

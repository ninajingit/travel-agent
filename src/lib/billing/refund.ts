import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { agentTransactions } from "@/db/schema";
import { stripe } from "./stripe";

type Transaction = typeof agentTransactions.$inferSelect;

/**
 * Payment intents this person has already had money back on.
 *
 * A cancellation row carries the same payment intent as the booking it
 * reverses, which is what links the two without another column and what
 * stops the same charge being refunded twice.
 */
export async function refundedIntents(userId: number): Promise<Set<string>> {
  const rows = await db
    .select({ id: agentTransactions.stripePaymentIntentId })
    .from(agentTransactions)
    .where(
      and(
        eq(agentTransactions.userId, userId),
        eq(agentTransactions.kind, "cancellation"),
        isNotNull(agentTransactions.stripePaymentIntentId),
      ),
    );
  return new Set(rows.map((row) => row.id as string));
}

export type RefundResult =
  | { ok: true; refundId: string; amountCents: number }
  | { ok: false; message: string };

/**
 * Give back what was charged for a booking.
 *
 * Refunds the whole charge. Partial refunds are a supplier question, not a
 * billing one: what a cancelled flight is actually worth back depends on the
 * fare rules, and Grace settles that by hand today (D12 keeps passes the same
 * way). Getting the money back in full and sorting the difference afterwards
 * is the honest default.
 */
export async function refundBooking(
  transaction: Transaction,
): Promise<RefundResult> {
  if (!transaction.stripePaymentIntentId) {
    return { ok: false, message: "Mira did not pay for this one, so there is nothing to refund." };
  }

  try {
    const refund = await stripe().refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
      metadata: { mira_transaction_id: String(transaction.id) },
    });
    return {
      ok: true,
      refundId: refund.id,
      amountCents: refund.amount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The refund did not go through.";
    return { ok: false, message };
  }
}

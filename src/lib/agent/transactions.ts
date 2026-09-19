import { db } from "@/db";
import { agentTransactions } from "@/db/schema";

export type TransactionInput = {
  tripId: number | null;
  kind: "booking" | "rebooking" | "cancellation";
  amountCents: number;
  currency?: string;
  description: string;
};

// Called by the agent when it books, rebooks, or cancels. One row per action.
export async function recordTransaction(userId: number, input: TransactionInput) {
  const [row] = await db
    .insert(agentTransactions)
    .values({ userId, currency: "USD", ...input })
    .returning();
  return row;
}

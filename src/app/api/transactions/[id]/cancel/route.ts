import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentTransactions } from "@/db/schema";
import { badRequest, notFound, parseId, readJsonObject, unauthorized } from "@/lib/api";
import { signedInUser } from "@/lib/auth";
import { recordTransaction } from "@/lib/agent/transactions";
import { refundBooking, refundedIntents } from "@/lib/billing/refund";

// Cancels something Mira booked and gives the money back.
const CAUSES = ["traveller", "mira"] as const;

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/transactions/[id]/cancel">,
) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  // Why matters, not just that. A traveller changing their mind is a second
  // piece of work and costs an action; Mira putting its own mistake right
  // does not.
  const body = await readJsonObject(request);
  const cause = body?.cancelledBy;
  if (!CAUSES.includes(cause as (typeof CAUSES)[number])) {
    return badRequest(`cancelledBy must be one of: ${CAUSES.join(", ")}.`);
  }

  const id = parseId((await params).id);
  if (!id) return notFound();

  const [transaction] = await db
    .select()
    .from(agentTransactions)
    .where(and(eq(agentTransactions.id, id), eq(agentTransactions.userId, user.id)))
    .limit(1);
  if (!transaction) return notFound();

  if (transaction.kind === "cancellation") {
    return NextResponse.json(
      { error: "That is already a cancellation." },
      { status: 409 },
    );
  }

  if (!transaction.stripePaymentIntentId) {
    return NextResponse.json(
      { error: "Mira did not pay for this one, so there is nothing to refund." },
      { status: 409 },
    );
  }

  // Refunding twice would hand back money that was only taken once.
  const already = await refundedIntents(user.id);
  if (already.has(transaction.stripePaymentIntentId)) {
    return NextResponse.json(
      { error: "This booking has already been cancelled and refunded." },
      { status: 409 },
    );
  }

  const refund = await refundBooking(transaction);
  if (!refund.ok) {
    return NextResponse.json({ error: refund.message }, { status: 502 });
  }

  // The money is back, so there is a record of it going back. Negative,
  // because that is the direction it moved; the Activity total then reads as
  // what this period actually cost.
  const row = await recordTransaction(user.id, {
    tripId: transaction.tripId,
    kind: "cancellation",
    amountCents: -refund.amountCents,
    currency: transaction.currency,
    description: `Cancelled: ${transaction.description}`,
    stripePaymentIntentId: transaction.stripePaymentIntentId,
    cancelledBy: cause as (typeof CAUSES)[number],
  });

  return NextResponse.json({ transaction: row, refundId: refund.refundId });
}

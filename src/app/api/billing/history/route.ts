import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { agentTransactions, conciergePasses, destinations, trips } from "@/db/schema";
import { unauthorized } from "@/lib/api";
import { signedInUser } from "@/lib/auth";
import { stripe } from "@/lib/billing/stripe";

export type HistoryEntry = {
  id: string;
  kind: "membership" | "pass" | "booking" | "rebooking" | "cancellation";
  at: string;
  amountCents: number;
  currency: string;
  description: string;
  /** Stripe's own receipt, when there is one. */
  href?: string;
  tripId?: number;
};

/**
 * Everything Stripe has ever taken from this person, in one list.
 *
 * Two shapes of money end up on one customer: invoices that Billing raises
 * for a membership, and payments Mira makes for flights and hotels. They
 * live in different places for good reasons, and a person looking at their
 * card statement does not care. This puts them in one order.
 *
 * A route rather than the page, because invoices are Stripe's and pages here
 * never wait on Stripe. The booking side is local and could render instantly;
 * splitting the list in two to save a moment would defeat the point of it.
 */
export async function GET() {
  const user = await signedInUser();
  if (!user) return unauthorized();
  if (!user.stripeCustomerId) return NextResponse.json({ entries: [] });

  const [invoices, passes, actions] = await Promise.all([
    stripe().invoices.list({ customer: user.stripeCustomerId, limit: 24 }),
    db
      .select({
        id: conciergePasses.id,
        amountCents: conciergePasses.amountCents,
        currency: conciergePasses.currency,
        purchasedAt: conciergePasses.purchasedAt,
        tripId: conciergePasses.tripId,
        destination: destinations.name,
      })
      .from(conciergePasses)
      .innerJoin(trips, eq(trips.id, conciergePasses.tripId))
      .innerJoin(destinations, eq(destinations.id, trips.destinationId))
      .where(eq(conciergePasses.userId, user.id)),
    db
      .select({
        id: agentTransactions.id,
        kind: agentTransactions.kind,
        amountCents: agentTransactions.amountCents,
        currency: agentTransactions.currency,
        description: agentTransactions.description,
        occurredAt: agentTransactions.occurredAt,
        tripId: agentTransactions.tripId,
      })
      .from(agentTransactions)
      .where(
        and(
          eq(agentTransactions.userId, user.id),
          // Only what Mira actually paid for. A booking from before Phase B
          // never touched a card and would read as a charge that never was.
          isNotNull(agentTransactions.stripePaymentIntentId),
        ),
      )
      .orderBy(desc(agentTransactions.occurredAt)),
  ]);

  const entries: HistoryEntry[] = [
    ...invoices.data
      // A draft or void invoice is not money that moved.
      .filter((invoice) => invoice.amount_paid > 0)
      .map((invoice) => ({
        id: invoice.id ?? `inv_${invoice.created}`,
        kind: "membership" as const,
        at: new Date(invoice.created * 1000).toISOString(),
        amountCents: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        description:
          invoice.lines.data[0]?.description ?? "Mira membership",
        href: invoice.hosted_invoice_url ?? undefined,
      })),
    ...passes.map((pass) => ({
      id: `pass_${pass.id}`,
      kind: "pass" as const,
      at: pass.purchasedAt.toISOString(),
      amountCents: pass.amountCents,
      currency: pass.currency,
      description: `Concierge Pass, ${pass.destination} trip`,
      tripId: pass.tripId,
    })),
    ...actions.map((action) => ({
      id: `act_${action.id}`,
      kind: action.kind,
      at: action.occurredAt.toISOString(),
      amountCents: action.amountCents,
      currency: action.currency,
      description: action.description,
      tripId: action.tripId ?? undefined,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json({ entries });
}

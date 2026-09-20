import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentTransactions, users } from "@/db/schema";
import { getAgentSettings } from "@/db/queries/agent-settings";
import { monthBounds } from "@/db/queries/agent-transactions";
import { appBaseUrl } from "./checkout";
import { stripe } from "./stripe";
import { METADATA } from "./webhook";

type User = typeof users.$inferSelect;

export type CapName = "booking" | "trip" | "month";

export type ChargeRequest = {
  user: User;
  tripId: number | null;
  amountCents: number;
  description: string;
};

export type ChargeResult =
  /** Paid. The booking may go ahead. */
  | { ok: true; paymentIntentId: string }
  /** Over one of the caps: ask before spending it. */
  | { ok: false; reason: "cap"; cap: CapName; limitCents: number; spentCents: number }
  /** No agreement on file to charge this card for bookings. */
  | { ok: false; reason: "consent" }
  /** No card to charge. */
  | { ok: false; reason: "no_card" }
  /** The bank wants the person present. A link brings them back. */
  | { ok: false; reason: "authentication"; url: string }
  /** Declined, or anything else the card did. */
  | { ok: false; reason: "declined"; message: string };

async function spent(userId: number, where: ReturnType<typeof and>) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${agentTransactions.amountCents}), 0)::int` })
    .from(agentTransactions)
    .where(and(eq(agentTransactions.userId, userId), where));
  return row?.total ?? 0;
}

/**
 * Which cap this booking would break, if any.
 *
 * The caps are the traveller's own limits on the agent, and the words shipped
 * with them say they are the most Mira may spend "without asking first". So
 * breaking one is a question, not a refusal, and the caller turns this into
 * one. Cancellations are money coming back and are not capped.
 */
export async function capExceeded(request: ChargeRequest) {
  const settings = await getAgentSettings(request.user.id);
  const { amountCents, tripId, user } = request;

  if (amountCents > settings.perBookingCapCents) {
    return {
      cap: "booking" as const,
      limitCents: settings.perBookingCapCents,
      spentCents: amountCents,
    };
  }

  if (tripId !== null) {
    const onTrip = await spent(user.id, eq(agentTransactions.tripId, tripId));
    if (onTrip + amountCents > settings.perTripCapCents) {
      return {
        cap: "trip" as const,
        limitCents: settings.perTripCapCents,
        spentCents: onTrip,
      };
    }
  }

  // "Per month" on the settings page means a calendar month, which is what it
  // says. Deliberately not the billing period: these are the traveller's
  // limits on spending, not an allowance we sold them.
  const now = new Date();
  const { start, end } = monthBounds(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const thisMonth = await spent(
    user.id,
    and(
      gte(agentTransactions.occurredAt, start),
      lt(agentTransactions.occurredAt, end),
    ),
  );
  if (thisMonth + amountCents > settings.monthlyCapCents) {
    return {
      cap: "month" as const,
      limitCents: settings.monthlyCapCents,
      spentCents: thisMonth,
    };
  }

  return null;
}

/**
 * Charge the saved card for something Mira is about to book.
 *
 * Runs before the booking exists. If this does not come back ok, nothing is
 * booked and nothing is recorded, so there is never a reservation nobody paid
 * for. `skipCaps` is for a booking the person has just been asked about and
 * said yes to.
 */
export async function chargeForBooking(
  request: ChargeRequest,
  options: { skipCaps?: boolean } = {},
): Promise<ChargeResult> {
  const { user, tripId, amountCents, description } = request;

  if (!user.bookingConsentAt) return { ok: false, reason: "consent" };
  if (!user.stripeCustomerId) return { ok: false, reason: "no_card" };

  if (!options.skipCaps) {
    const over = await capExceeded(request);
    if (over) return { ok: false, reason: "cap", ...over };
  }

  // The card the person expects to be charged is the one their membership
  // renews on, so prefer the customer's default and only fall back to
  // whatever else is attached.
  const customer = await stripe().customers.retrieve(user.stripeCustomerId);
  const preferred = customer.deleted
    ? null
    : customer.invoice_settings?.default_payment_method;
  const defaultCardId =
    typeof preferred === "string" ? preferred : (preferred?.id ?? null);
  const cardId =
    defaultCardId ??
    (
      await stripe().paymentMethods.list({
        customer: user.stripeCustomerId,
        limit: 1,
      })
    ).data[0]?.id;
  if (!cardId) return { ok: false, reason: "no_card" };

  const metadata = {
    [METADATA.userId]: String(user.id),
    ...(tripId === null ? {} : { [METADATA.tripId]: String(tripId) }),
  };

  try {
    const intent = await stripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: user.stripeCustomerId,
      payment_method: cardId,
      // The person is not here. Stripe uses the agreement from checkout to
      // ask the bank for an exemption; when the bank refuses, it lands in the
      // catch below rather than failing quietly.
      off_session: true,
      confirm: true,
      description,
      metadata,
    });
    return { ok: true, paymentIntentId: intent.id };
  } catch (error) {
    const stripeError = error as {
      code?: string;
      message?: string;
      payment_intent?: { id?: string };
    };

    if (stripeError.code === "authentication_required") {
      // Bring them back on-session. Hosted Checkout again rather than a card
      // form of our own, so nothing card-shaped is ever rendered here.
      const base = appBaseUrl();
      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        customer: user.stripeCustomerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: { name: description },
            },
          },
        ],
        success_url: `${base}/app/activity?charge=confirmed`,
        cancel_url: tripId ? `${base}/app/trips/${tripId}` : `${base}/app`,
        metadata,
        payment_intent_data: { metadata, setup_future_usage: "off_session" },
      });
      return { ok: false, reason: "authentication", url: session.url ?? base };
    }

    return {
      ok: false,
      reason: "declined",
      message: stripeError.message ?? "The card was declined.",
    };
  }
}

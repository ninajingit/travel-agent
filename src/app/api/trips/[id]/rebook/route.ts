import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import { badRequest, notFound, parseId, readJsonObject, unauthorized } from "@/lib/api";
import { getTrip, rebookSegment } from "@/db/queries/trips";
import { reportFor } from "@/lib/agent/monitoring";
import { recordTransaction } from "@/lib/agent/transactions";
import { getEntitlement, refuseAction } from "@/lib/billing/entitlement";
import { chargeForBooking } from "@/lib/billing/charge";

// The person accepts the suggested replacement for a delayed segment.
export async function POST(request: Request, { params }: RouteContext<"/api/trips/[id]/rebook">) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const tripId = parseId((await params).id);
  if (!tripId) return notFound();
  const trip = await getTrip(user.id, tripId);
  if (!trip) return notFound();

  const body = await readJsonObject(request);
  if (!body || typeof body.segmentId !== "number") {
    return badRequest("segmentId is required.");
  }
  const segment = trip.segments.find((s) => s.id === body.segmentId);
  if (!segment) return notFound();

  const report = reportFor(segment);
  if (!report?.replacement) {
    return badRequest("There is no replacement to accept for this segment.");
  }

  // Rebooking spends money on this person's behalf, so it is an agent action
  // like any other. Refused before anything is changed, never halfway.
  const entitlement = await getEntitlement(user.id);
  const refusal = refuseAction(entitlement, trip.id);
  if (refusal) {
    const resetsOn = entitlement.periodEnd.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return NextResponse.json(
      {
        error:
          refusal.reason === "plan"
            ? "Rebooking is not included on the free plan. Plus lets Mira move you when a flight slips."
            : `You have used all ${entitlement.actionsAllowed} actions this period. The count resets on ${resetsOn}.`,
      },
      { status: 403 },
    );
  }

  // Money first: a rebook that cannot be paid for must not change the
  // itinerary. Over a cap it comes back as a question, which this route
  // surfaces as a 409 the panel shows; the caller decides, not the agent.
  const description = `${segment.carrier} rebooked to ${report.replacement.carrier}, ${report.replacement.ref}`;
  const charge = await chargeForBooking({
    user,
    tripId: trip.id,
    amountCents: report.replacement.amountCents,
    description,
  });

  if (!charge.ok) {
    const body =
      charge.reason === "cap"
        ? {
            error: `This is over your ${charge.cap === "booking" ? "per-booking cap" : charge.cap === "trip" ? "cap for this trip" : "cap for this month"}, so Mira has not booked it. Raise the cap in agent settings to go ahead.`,
          }
        : charge.reason === "authentication"
          ? {
              error: "Your bank wants to confirm this payment before it goes through. Nothing has been booked.",
              confirmUrl: charge.url,
            }
          : charge.reason === "consent"
            ? { error: "Mira does not have your agreement to charge your card for bookings yet." }
            : { error: "Your card was declined, so nothing has been booked." };
    return NextResponse.json(body, { status: 409 });
  }

  const result = await rebookSegment(trip.id, segment.id, {
    kind: segment.kind,
    carrier: report.replacement.carrier,
    ref: report.replacement.ref,
    departAt: report.replacement.departAt,
    arriveAt: report.replacement.arriveAt,
  });
  if (!result) return badRequest("This segment is no longer delayed.");

  const transaction = await recordTransaction(user.id, {
    tripId: trip.id,
    kind: "rebooking",
    amountCents: report.replacement.amountCents,
    description,
    stripePaymentIntentId: charge.paymentIntentId,
  });

  return NextResponse.json({ ...result, transaction });
}

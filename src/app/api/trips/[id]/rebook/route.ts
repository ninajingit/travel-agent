import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import { badRequest, notFound, parseId, readJsonObject, unauthorized } from "@/lib/api";
import { getTrip, rebookSegment } from "@/db/queries/trips";
import { reportFor } from "@/lib/agent/monitoring";
import { recordTransaction } from "@/lib/agent/transactions";
import { getEntitlement, refuseAction } from "@/lib/billing/entitlement";

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
    description: `${segment.carrier} rebooked to ${report.replacement.carrier}, ${report.replacement.ref}`,
  });

  return NextResponse.json({ ...result, transaction });
}

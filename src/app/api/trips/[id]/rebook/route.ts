import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import { badRequest, notFound, parseId, readJsonObject, unauthorized } from "@/lib/api";
import { getTrip, rebookSegment } from "@/db/queries/trips";
import { reportFor } from "@/lib/agent/monitoring";
import { recordTransaction } from "@/lib/agent/transactions";

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

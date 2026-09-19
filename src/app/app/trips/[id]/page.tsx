import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUser } from "@/lib/auth";
import { getTrip } from "@/db/queries/trips";
import { parseId } from "@/lib/api";
import {
  formatDateRange,
  formatDateTime,
  segmentKindLabel,
  segmentStatusLabel,
  segmentStatusTone,
  tripStatusLabel,
  tripStatusTone,
} from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";

export default async function TripPage({ params }: PageProps<"/app/trips/[id]">) {
  const user = await ensureUser();
  const id = parseId((await params).id);
  const trip = id ? await getTrip(user.id, id) : null;
  if (!trip) notFound();

  return (
    <div>
      <Link href="/app/trips" className="text-sm text-muted hover:text-fg">
        ← My Trips
      </Link>

      <div className="mt-4">
        <PageHeader
          title={
            <>
              {trip.destination.name}
              <span className="ml-3 text-xl font-medium text-muted sm:text-2xl">
                {trip.destination.country}
              </span>
            </>
          }
          intro={formatDateRange(trip.startsAt, trip.endsAt)}
          aside={
            <Pill tone={tripStatusTone(trip.status)}>
              {tripStatusLabel(trip.status)}
            </Pill>
          }
        />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Itinerary
      </h2>
      {trip.segments.length === 0 ? (
        <div className="mt-3">
          <EmptyState>
            Nothing booked yet. Flights, stays, and trains show up here as
            Passage books them.
          </EmptyState>
        </div>
      ) : (
        <Card className="mt-3 divide-y divide-border">
          {trip.segments.map((segment) => (
            <div
              key={segment.id}
              className="grid gap-2 p-5 sm:grid-cols-[5rem_1fr_auto] sm:items-start"
            >
              <div className="text-sm font-medium text-muted">
                {segmentKindLabel(segment.kind)}
              </div>
              <div>
                <div className="font-semibold">{segment.carrier}</div>
                <div className="mt-1 text-sm text-muted">
                  {formatDateTime(segment.departAt)} →{" "}
                  {formatDateTime(segment.arriveAt)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted">
                  {segment.ref}
                </div>
              </div>
              <Pill tone={segmentStatusTone(segment.status)}>
                {segmentStatusLabel(segment.status)}
              </Pill>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

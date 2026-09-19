import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { listTrips } from "@/db/queries/trips";
import { formatDateRange, tripStatusLabel, tripStatusTone } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";

export default async function TripsPage() {
  const user = await ensureUser();
  const rows = await listTrips(user.id);

  return (
    <div>
      <PageHeader
        title="My Trips"
        intro="Everything planned or booked, and what Passage is watching right now."
      />

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState>
            No trips yet. Save a place under Inspiration and Passage will start
            planning around it.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {rows.map((trip) => (
            <li key={trip.id}>
              <Card className="transition hover:border-muted">
                <Link
                  href={`/app/trips/${trip.id}`}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <div className="font-display text-xl font-bold">
                      {trip.destination.name}
                      <span className="ml-2 text-base font-medium text-muted">
                        {trip.destination.country}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {formatDateRange(trip.startsAt, trip.endsAt)}
                    </div>
                  </div>
                  <Pill tone={tripStatusTone(trip.status)}>
                    {tripStatusLabel(trip.status)}
                  </Pill>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

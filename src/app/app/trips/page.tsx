import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { listTrips } from "@/db/queries/trips";
import { formatDateRange, tripStatusLabel, tripStatusTone } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getEntitlement } from "@/lib/billing/entitlement";

export default async function TripsPage() {
  const user = await ensureUser();
  const [rows, entitlement] = await Promise.all([
    listTrips(user.id),
    getEntitlement(user.id),
  ]);
  const onFree = entitlement.plan === "free" && entitlement.passes.length === 0;
  // Only say "these are plans" when they actually are. Someone whose
  // membership lapsed keeps the trips Mira already booked, and telling them
  // those were never booked would be false.
  const allPlans = rows.length > 0 && rows.every((trip) => trip.status === "planned");

  return (
    <div>
      <PageHeader
        title="My Trips"
        intro="Everything planned or booked, and what Mira is watching right now."
      />

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState>
            No trips yet. Save a place under Inspiration and Mira will start
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

      {onFree && allPlans && (
        <UpgradePrompt
          heading="These are plans, not bookings"
          tripId={rows[0]?.id}
          trialAvailable={user.trialUsedAt === null}
        >
          Mira has worked out the flights and rooms for these, and on the free
          plan it hands you the links to book them yourself. With a membership
          it books them, keeps the confirmations here, and watches every
          segment for delays and gate changes while you travel.
        </UpgradePrompt>
      )}
    </div>
  );
}

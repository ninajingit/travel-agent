import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { listTrips } from "@/db/queries/trips";
import { formatDateRange, tripStatusLabel } from "@/lib/format";

export default async function TripsPage() {
  const user = await ensureUser();
  const rows = await listTrips(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Trips</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Everything Passage has planned or booked for you.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No trips yet. Add a destination and Passage will start watching fares.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/app/trips/${trip.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
              <div>
                <div className="font-medium">
                  {trip.destination.name}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {trip.destination.country}
                  </span>
                </div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {formatDateRange(trip.startsAt, trip.endsAt)}
                </div>
              </div>
              <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                {tripStatusLabel(trip.status)}
              </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

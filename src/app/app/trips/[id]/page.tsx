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
  tripStatusLabel,
} from "@/lib/format";

export default async function TripPage({ params }: PageProps<"/app/trips/[id]">) {
  const user = await ensureUser();
  const id = parseId((await params).id);
  const trip = id ? await getTrip(user.id, id) : null;
  if (!trip) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/app/trips"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Trips
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {trip.destination.name}
            <span className="ml-2 text-base font-normal text-zinc-500">
              {trip.destination.country}
            </span>
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatDateRange(trip.startsAt, trip.endsAt)}
          </p>
        </div>
        <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          {tripStatusLabel(trip.status)}
        </span>
      </div>

      <h2 className="mt-8 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Itinerary
      </h2>
      {trip.segments.length === 0 ? (
        <p className="mt-2 rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Nothing booked yet. Segments appear here as Passage books them.
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {trip.segments.map((segment) => (
            <li key={segment.id} className="grid gap-1 p-4 sm:grid-cols-[6rem_1fr_auto]">
              <div className="text-sm text-zinc-500">
                {segmentKindLabel(segment.kind)}
              </div>
              <div>
                <div className="font-medium">{segment.carrier}</div>
                <div className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {formatDateTime(segment.departAt)} →{" "}
                  {formatDateTime(segment.arriveAt)}
                </div>
                <div className="mt-0.5 font-mono text-xs text-zinc-500">
                  {segment.ref}
                </div>
              </div>
              <div
                className={`text-sm font-medium ${
                  segment.status === "delayed"
                    ? "text-amber-700 dark:text-amber-400"
                    : segment.status === "cancelled"
                      ? "text-red-700 dark:text-red-400"
                      : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {segmentStatusLabel(segment.status)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

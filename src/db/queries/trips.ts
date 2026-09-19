import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { destinations, trips, tripSegments } from "@/db/schema";

// Trips for the list view: one row per trip with its destination's name and
// country, soonest first. Scoped to the owner like every query here.
export function listTrips(userId: number) {
  return db
    .select({
      id: trips.id,
      status: trips.status,
      startsAt: trips.startsAt,
      endsAt: trips.endsAt,
      destination: {
        name: destinations.name,
        country: destinations.country,
      },
    })
    .from(trips)
    .innerJoin(destinations, eq(trips.destinationId, destinations.id))
    .where(eq(trips.userId, userId))
    .orderBy(asc(trips.startsAt));
}

// One trip with its destination and every segment in departure order, or
// null when the id is unknown or belongs to someone else.
export async function getTrip(userId: number, id: number) {
  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, id), eq(trips.userId, userId)),
  });
  if (!trip) return null;

  const [destination, segments] = await Promise.all([
    db.query.destinations.findFirst({
      where: eq(destinations.id, trip.destinationId),
    }),
    db.query.tripSegments.findMany({
      where: eq(tripSegments.tripId, trip.id),
      orderBy: asc(tripSegments.departAt),
    }),
  ]);
  if (!destination) return null;

  return { ...trip, destination, segments };
}

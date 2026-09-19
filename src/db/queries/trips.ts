import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { destinations, trips } from "@/db/schema";

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

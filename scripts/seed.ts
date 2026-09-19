// Seeds the demo account. Safe to run repeatedly: every write is an upsert
// keyed on something stable, so a second run changes nothing.
//
//   SEED_EMAIL=you@example.com npm run db:seed
//
// The person must already exist in Clerk (sign up once first). Later commits
// add seed functions for their own tables below seedUser.
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  agentSettings,
  destinations,
  tripSegments,
  trips,
  users,
} from "@/db/schema";

async function seedUser(email: string) {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const profile = data[0];
  if (!profile) {
    throw new Error(`No Clerk user with email ${email}. Sign up first.`);
  }
  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null;

  const [user] = await db
    .insert(users)
    .values({ clerkId: profile.id, email, name })
    .onConflictDoUpdate({ target: users.clerkId, set: { email, name } })
    .returning();
  return user;
}

const DESTINATIONS = [
  { name: "Lisbon", country: "Portugal", notes: "Prefer TAP nonstop from EWR." },
  { name: "Tokyo", country: "Japan", notes: "Late March if fares allow." },
  { name: "Mexico City", country: "Mexico", notes: null },
];

async function seedDestinations(userId: number) {
  const rows = [];
  for (const input of DESTINATIONS) {
    const existing = await db.query.destinations.findFirst({
      where: and(
        eq(destinations.userId, userId),
        eq(destinations.name, input.name),
      ),
    });
    if (existing) {
      rows.push(existing);
      continue;
    }
    const [row] = await db
      .insert(destinations)
      .values({ userId, ...input })
      .returning();
    rows.push(row);
  }
  return rows;
}

// Two trips: one booked and upcoming, one under way with a delayed return
// so the monitoring view has something to show. Keyed on (user, destination,
// start date); segments are only written when the trip is first created.
type SegmentSeed = typeof tripSegments.$inferInsert;

const TRIPS: Array<{
  destination: string;
  status: typeof trips.$inferInsert.status;
  startsAt: string;
  endsAt: string;
  segments: Omit<SegmentSeed, "tripId">[];
}> = [
  {
    destination: "Lisbon",
    status: "booked",
    startsAt: "2026-10-14",
    endsAt: "2026-10-21",
    segments: [
      {
        kind: "flight",
        carrier: "TAP Air Portugal TP 202",
        ref: "H7K2QF",
        departAt: new Date("2026-10-14T22:55:00Z"),
        arriveAt: new Date("2026-10-15T10:35:00Z"),
      },
      {
        kind: "hotel",
        carrier: "Memmo Alfama",
        ref: "MA-118204",
        departAt: new Date("2026-10-15T14:00:00Z"),
        arriveAt: new Date("2026-10-21T10:00:00Z"),
      },
      {
        kind: "flight",
        carrier: "TAP Air Portugal TP 201",
        ref: "H7K2QF",
        departAt: new Date("2026-10-21T13:10:00Z"),
        arriveAt: new Date("2026-10-21T20:40:00Z"),
      },
    ],
  },
  {
    destination: "Tokyo",
    status: "in_progress",
    startsAt: "2026-09-17",
    endsAt: "2026-09-25",
    segments: [
      {
        kind: "flight",
        carrier: "ANA NH 9",
        ref: "R4TX8L",
        departAt: new Date("2026-09-17T17:05:00Z"),
        arriveAt: new Date("2026-09-18T11:15:00Z"),
      },
      {
        kind: "hotel",
        carrier: "Hotel Niwa Tokyo",
        ref: "NW-77310",
        departAt: new Date("2026-09-18T06:00:00Z"),
        arriveAt: new Date("2026-09-25T02:00:00Z"),
      },
      {
        kind: "train",
        carrier: "JR Tokaido Shinkansen Nozomi 23",
        ref: "JR-0923-11A",
        departAt: new Date("2026-09-21T00:30:00Z"),
        arriveAt: new Date("2026-09-21T02:45:00Z"),
      },
      {
        kind: "flight",
        carrier: "ANA NH 10",
        ref: "R4TX8L",
        departAt: new Date("2026-09-25T08:05:00Z"),
        arriveAt: new Date("2026-09-25T18:50:00Z"),
        status: "delayed",
      },
    ],
  },
];

async function seedTrips(
  userId: number,
  places: Array<{ id: number; name: string }>,
) {
  const rows = [];
  for (const input of TRIPS) {
    const place = places.find((p) => p.name === input.destination);
    if (!place) {
      throw new Error(`Seed trip references unknown destination ${input.destination}`);
    }
    const existing = await db.query.trips.findFirst({
      where: and(
        eq(trips.userId, userId),
        eq(trips.destinationId, place.id),
        eq(trips.startsAt, input.startsAt),
      ),
    });
    if (existing) {
      rows.push(existing);
      continue;
    }
    const [trip] = await db
      .insert(trips)
      .values({
        userId,
        destinationId: place.id,
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      })
      .returning();
    await db
      .insert(tripSegments)
      .values(input.segments.map((s) => ({ ...s, tripId: trip.id })));
    rows.push(trip);
  }
  return rows;
}

// The demo account lets the agent rebook on its own. Only written once so a
// reseed never undoes what someone changed on the settings page.
async function seedAgentSettings(userId: number) {
  await db
    .insert(agentSettings)
    .values({
      userId,
      autoRebook: true,
      perBookingCapCents: 75_000,
      monthlyCapCents: 300_000,
      allowedChannels: ["web"],
    })
    .onConflictDoNothing();
}

async function main() {
  const email = process.env.SEED_EMAIL;
  if (!email) {
    throw new Error("SEED_EMAIL is not set.");
  }

  const user = await seedUser(email);
  console.log(`user          ${user.id}  ${user.email}`);

  const places = await seedDestinations(user.id);
  console.log(`destinations  ${places.map((d) => d.id).join(", ")}`);

  const tripRows = await seedTrips(user.id, places);
  console.log(`trips         ${tripRows.map((t) => t.id).join(", ")}`);

  await seedAgentSettings(user.id);
  console.log(`settings      ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  agentSettings,
  agentTransactions,
  conversations,
  destinations,
  messages,
  tripSegments,
  trips,
} from "@/db/schema";
import { CHATS } from "./chats";

// The demo account, for every account. Everyone who signs in gets the same
// two trips, saved places, past chats, and activity, so the product can be
// walked end to end by anyone. Every write is keyed on something stable, so
// running this twice for the same person changes nothing.

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
      perTripCapCents: 200_000,
      monthlyCapCents: 300_000,
      allowedChannels: ["web"],
    })
    .onConflictDoNothing();
}

// Past chats with the agent. Keyed on (user, title); messages are written only
// when the conversation is first created.
async function seedChats(
  userId: number,
  tripRows: Array<{ id: number; destinationId: number }>,
  places: Array<{ id: number; name: string }>,
) {
  let created = 0;
  for (const chat of CHATS) {
    const existing = await db.query.conversations.findFirst({
      where: and(eq(conversations.userId, userId), eq(conversations.title, chat.title)),
    });
    if (existing) continue;

    let tripId: number | null = null;
    if (chat.trip) {
      const place = places.find((p) => p.name === chat.trip);
      const trip = place && tripRows.find((t) => t.destinationId === place.id);
      if (!trip) {
        throw new Error(`Seed chat "${chat.title}" references unknown trip ${chat.trip}`);
      }
      tripId = trip.id;
    }

    const [conversation] = await db
      .insert(conversations)
      .values({ userId, tripId, title: chat.title, createdAt: new Date(chat.turns[0].at) })
      .returning();
    await db.insert(messages).values(
      chat.turns.map((turn) => ({
        conversationId: conversation.id,
        role: turn.role,
        body: turn.body,
        createdAt: new Date(turn.at),
      })),
    );
    created += 1;
  }
  return created;
}

// What the agent has done with money so far this month. Keyed on
// (user, description).
const TRANSACTIONS: Array<{
  destination: "Lisbon" | "Tokyo";
  kind: "booking" | "rebooking" | "cancellation";
  amountCents: number;
  description: string;
  occurredAt: string;
}> = [
  { destination: "Tokyo", kind: "booking", amountCents: 184_200, description: "ANA NH 9 and NH 10, Chicago to Tokyo, R4TX8L", occurredAt: "2026-09-02T15:20:00Z" },
  { destination: "Tokyo", kind: "booking", amountCents: 112_000, description: "Hotel Niwa Tokyo, seven nights, NW-77310", occurredAt: "2026-09-03T18:05:00Z" },
  { destination: "Lisbon", kind: "booking", amountCents: 136_800, description: "TAP TP 202 and TP 201, Newark to Lisbon, two seats, H7K2QF", occurredAt: "2026-09-06T13:40:00Z" },
  { destination: "Lisbon", kind: "booking", amountCents: 168_000, description: "Memmo Alfama, six nights, MA-118204", occurredAt: "2026-09-06T13:52:00Z" },
];

async function seedTransactions(
  userId: number,
  tripRows: Array<{ id: number; destinationId: number }>,
  places: Array<{ id: number; name: string }>,
) {
  let created = 0;
  for (const input of TRANSACTIONS) {
    const existing = await db.query.agentTransactions.findFirst({
      where: and(
        eq(agentTransactions.userId, userId),
        eq(agentTransactions.description, input.description),
      ),
    });
    if (existing) continue;
    const place = places.find((p) => p.name === input.destination);
    const trip = place && tripRows.find((t) => t.destinationId === place.id);
    if (!trip) {
      throw new Error(`Seed transaction references unknown trip ${input.destination}`);
    }
    await db.insert(agentTransactions).values({
      userId,
      tripId: trip.id,
      kind: input.kind,
      amountCents: input.amountCents,
      description: input.description,
      occurredAt: new Date(input.occurredAt),
    });
    created += 1;
  }
  return created;
}

export async function seedDemoData(userId: number) {
  const places = await seedDestinations(userId);
  const tripRows = await seedTrips(userId, places);
  await seedAgentSettings(userId);
  const newChats = await seedChats(userId, tripRows, places);
  const newTransactions = await seedTransactions(userId, tripRows, places);
  return {
    destinations: places.length,
    trips: tripRows.length,
    chats: { total: CHATS.length, created: newChats },
    transactions: { total: TRANSACTIONS.length, created: newTransactions },
  };
}

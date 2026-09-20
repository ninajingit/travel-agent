import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// One row per person who has signed in. clerk_id is the identity; everything
// else is a copy of what Clerk told us at the time.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Places a person wants to go. Archiving hides a destination without losing
// the trips that point at it.
export const destinations = pgTable("destinations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  country: text("country").notNull(),
  notes: text("notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const tripStatus = pgEnum("trip_status", [
  "planned",
  "booked",
  "in_progress",
  "complete",
  "cancelled",
]);

// A trip is one visit to a destination. Dates are calendar days in the
// traveller's terms; the precise times live on the segments.
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  destinationId: integer("destination_id")
    .notNull()
    .references(() => destinations.id),
  status: tripStatus("status").notNull().default("planned"),
  startsAt: date("starts_at").notNull(),
  endsAt: date("ends_at").notNull(),
});

export const segmentKind = pgEnum("segment_kind", ["flight", "hotel", "train"]);

export const segmentStatus = pgEnum("segment_status", [
  "scheduled",
  "delayed",
  "rebooked",
  "cancelled",
]);

// One booked thing inside a trip: a flight, a hotel stay, a train. ref is the
// supplier's confirmation code.
export const tripSegments = pgTable("trip_segments", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => trips.id),
  kind: segmentKind("kind").notNull(),
  carrier: text("carrier").notNull(),
  ref: text("ref").notNull(),
  departAt: timestamp("depart_at", { withTimezone: true }).notNull(),
  arriveAt: timestamp("arrive_at", { withTimezone: true }).notNull(),
  status: segmentStatus("status").notNull().default("scheduled"),
});

export const channelKind = pgEnum("channel_kind", ["web", "whatsapp", "imessage"]);

// How much rope the agent has. The caps are the most Nomi may spend on a
// person's behalf without asking them first; they are the traveller's own
// limits on the agent. One row per user, created with defaults on first read.
export const agentSettings = pgTable("agent_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id),
  autoRebook: boolean("auto_rebook").notNull().default(false),
  perBookingCapCents: integer("per_booking_cap_cents").notNull().default(50_000),
  perTripCapCents: integer("per_trip_cap_cents").notNull().default(150_000),
  monthlyCapCents: integer("monthly_cap_cents").notNull().default(200_000),
  allowedChannels: channelKind("allowed_channels")
    .array()
    .notNull()
    .default(["web"]),
});

// A conversation is one thread with the agent, optionally about a trip.
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tripId: integer("trip_id").references(() => trips.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messageRole = pgEnum("message_role", ["user", "agent"]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: messageRole("role").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactionKind = pgEnum("transaction_kind", [
  "booking",
  "rebooking",
  "cancellation",
]);

// A record that the agent did something with money on a person's behalf:
// booked, rebooked, or cancelled. Written by the agent at the moment it acts.
export const agentTransactions = pgTable("agent_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tripId: integer("trip_id").references(() => trips.id),
  kind: transactionKind("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

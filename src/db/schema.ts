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
  // Set the first time this person reaches Stripe, not at sign-up. Someone who
  // never pays never gets a Stripe customer.
  stripeCustomerId: text("stripe_customer_id").unique(),
  // Stripe does not stop a person starting a second trial on a second
  // subscription, so the app remembers. Set when a trialing subscription is
  // first seen, and never cleared.
  trialUsedAt: timestamp("trial_used_at", { withTimezone: true }),
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

// How much rope the agent has. The caps are the most Mira may spend on a
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

export const plan = pgEnum("plan", ["plus", "pro"]);

// A mirror of a Stripe subscription, written by the webhook and read by
// everything else, so no page render waits on a Stripe call.
//
// There is a row per Stripe subscription, not per person: cancelling and
// coming back later leaves both. The current one is the row whose status is
// still live. Free is the absence of any such row, never a $0 subscription.
//
// `status` is text rather than an enum because it is Stripe's word, and
// Stripe may add to the list without asking. The app compares against the
// handful of values it knows and treats the rest as not-entitled.
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  plan: plan("plan").notNull(),
  status: text("status").notNull(),
  priceLookupKey: text("price_lookup_key").notNull(),
  // Stripe moved these onto the subscription's items in 2025-03-31.basil.
  // They are flattened back to the subscription here because Mira sells one
  // item per subscription; the webhook reads items.data[0].
  currentPeriodStart: timestamp("current_period_start", {
    withTimezone: true,
  }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", {
    withTimezone: true,
  }).notNull(),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One trip bought out of a membership. Coverage runs from purchase to the
// trip's end date as it stands at the time of asking, so a trip that gets
// extended stays covered; that is why no end date is stored here.
export const conciergePasses = pgTable("concierge_passes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tripId: integer("trip_id")
    .notNull()
    .references(() => trips.id),
  // Unique so a replayed checkout.session.completed cannot grant twice.
  stripeCheckoutSessionId: text("stripe_checkout_session_id")
    .notNull()
    .unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  // What Checkout reported. With Adaptive Pricing on, a customer abroad may
  // have paid in their own currency, so this is not always USD 15000.
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Every Stripe event this app has seen, keyed by Stripe's own event id. The
// webhook inserts here before it does any work, so a redelivery collides and
// becomes a no-op. processed_at stays null if the handler threw, which is how
// a failed event is told apart from one that was never received.
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

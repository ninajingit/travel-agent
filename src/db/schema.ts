import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
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
  // When this person agreed that Mira may charge their card for the flights
  // and hotels it books. A different agreement from paying for a membership,
  // so it is recorded separately; the card networks treat the two as
  // different purposes and Stripe expects a record of the agreement kept.
  bookingConsentAt: timestamp("booking_consent_at", { withTimezone: true }),
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

// Who a cancellation was for. Only set on cancellations.
//
// It decides whether the cancellation costs an agent action. A traveller
// changing their mind is Mira doing a second piece of work for them, so it
// counts. Mira undoing its own mistake is not work the traveller asked for,
// so the booking and its reversal together cost the one action the booking
// already cost.
export const cancelledBy = pgEnum("cancelled_by", ["traveller", "mira"]);

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
  // The charge that paid for this, once Mira pays for what it books. Null on
  // everything written before Phase B, and on anything a supplier refunds.
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  cancelledBy: cancelledBy("cancelled_by"),
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

// One row per currency we quote on the pricing page. Written by the daily
// refresh, read by the page, because a page may not call Stripe.
//
// Both rates are kept. base_rate is Stripe's mid-market rate and is the one
// we do arithmetic with. quoted_rate includes Stripe's 1% FX fee and is
// stored only so the refresh can show its working; nothing displays it.
// Neither is what the customer is charged: Adaptive Pricing re-converts at
// checkout at roughly base_rate plus 4%, which is where ADAPTIVE_MARKUP in
// the estimate comes from.
//
// Rates are the local currency expressed in USD, the direction the FX Quotes
// API returns: 1 EUR = 1.14806 USD. To go the other way, divide.
export const fxRates = pgTable(
  "fx_rates",
  {
    id: serial("id").primaryKey(),
    // ISO 4217, lower case, matching Stripe. "jpy", not "JPY".
    currency: text("currency").notNull(),
    // numeric, not a float. These get divided into prices and the result is
    // shown to people, so binary rounding error is not acceptable. Drizzle
    // hands these back as strings for the same reason.
    baseRate: numeric("base_rate", { precision: 20, scale: 10 }).notNull(),
    quotedRate: numeric("quoted_rate", { precision: 20, scale: 10 }).notNull(),
    // The fx_quote this came from, so a number on the page can be traced back
    // to one Stripe object.
    stripeFxQuoteId: text("stripe_fx_quote_id").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // One row per currency. The refresh upserts on this, so a retry that runs
  // twice in the same minute leaves one row rather than two.
  (table) => [uniqueIndex("fx_rates_currency_key").on(table.currency)],
);

// What each thing we sell costs, copied from Stripe. Written by the webhook
// when a price changes and by a nightly job as a safety net; read by every
// page and every sentence that quotes a number.
//
// Here because a page may not call Stripe, and because the alternative is
// what we had: the same figure typed into seven files and a Dashboard, with
// nothing to notice when they stopped agreeing.
//
// Keyed by lookup key, not price id. Stripe prices are immutable, so changing
// what something costs means creating a new price and moving the lookup key
// onto it. The key is the stable name; the id underneath it is not.
export const catalogPrices = pgTable("catalog_prices", {
  id: serial("id").primaryKey(),
  lookupKey: text("lookup_key").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  productName: text("product_name").notNull(),
  unitAmount: integer("unit_amount").notNull(),
  currency: text("currency").notNull(),
  // "month" for a membership, null for the one-off pass. Drives the "per
  // month" beside the figure, so that cannot drift either.
  interval: text("interval"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});


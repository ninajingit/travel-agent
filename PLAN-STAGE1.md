# PLAN-STAGE1.md

Stage 1: build the Passage application. No payments, no billing, no
subscriptions. Commits 1 through 28.

A later stage, run in a separate session, adds Stripe starting at commit 29.
That plan is deliberately not in this repo yet. Do not go looking for it and
do not prepare for it.

## Scope boundary

**In scope:** authenticated users, saved destinations ("Inspiration"),
trips, agent configuration, a simulated agent chat with history, a chat-first
home page with trip inspiration, and an activity record of what the agent did.

**Out of scope, and this is the important half:** no plan or tier column, no
subscriptions table, no Stripe dependency, no upgrade buttons, no paywall, no
feature gates, no "coming soon" billing placeholders, no `is_premium` boolean
anywhere. Not commented out either.

The one thing that must be right for later: `agent_transactions` exists as a
pure product record, written because the agent did something, with no
awareness that it will ever be counted for money.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Neon Postgres via the Vercel Marketplace, Drizzle ORM
- Clerk for auth
- Deployed on Vercel, US East

## Phase 0: Scaffold

| # | Commit | Gate |
|---|--------|------|
| 1 | `init` Next.js App Router, TypeScript, Tailwind, ESLint | `npm run dev` serves |
| 2 | `db` Neon via Vercel Marketplace, Drizzle, first migration | `users` table exists |
| 3 | `auth` Clerk, protected `/app` routes | signed-out redirect works |
| 4 | `deploy` push to Vercel, real domain, env vars wired | production URL loads |
| 5 | `seed` demo user, 3 destinations, 2 trips, 4 agent transactions | seed script is idempotent |

Commit 4 is early on purpose. Getting Vercel, env plumbing, and the domain
working now means that when Stripe arrives later, Stripe is the only new
variable.

## Phase 1: Product

| # | Commit | Gate |
|---|--------|------|
| 6 | destinations schema and API routes | CRUD via curl |
| 7 | destinations UI: list, add, edit, archive | works in browser |
| 8 | trips schema and list view | seeded trips render |
| 9 | trip detail: itinerary, segments, status | deep link works |
| 10 | agent settings schema and page | auto-rebook toggle, per-booking cap, monthly cap, all persist |
| 11 | channel abstraction plus stub adapters | `web`, `whatsapp`, `imessage` behind one interface |
| 12 | product reframe: copy, "My Trips" and "Inspiration" nav, settings in the account menu | nav and copy in browser |
| 13 | design system: theme tokens, shared UI primitives, existing screens restyled | every screen in the new look, light and dark |
| 14 | `conversations` and `messages` schema, seeded chat history | seed idempotent, rows present |
| 15 | agent chat panel, web adapter, canned responses, persisted, with history | conversation renders, scripted, survives reload |
| 16 | home: chat composer plus upcoming-trip inspiration, static content | renders for seeded trips |
| 17 | `agent_transactions` schema plus write path from chat | booking in chat creates a row |
| 18 | activity view: this month's agent transactions, running count | count matches rows |
| 19 | trip monitoring view: delay detected, rebook suggested, rebook accepted | accepting writes a transaction |
| 20 | landing and pricing pages, static marketing copy only | no auth coupling, nothing functional |
| 21 | chat composer: example requests typed and erased in place of starter buttons | animation runs on an empty thread, stops once typing starts |
| 22 | account menu follows the page theme; Pricing link in the menu | readable in light and dark, link opens the static page |
| 23 | demo data seeded for every account on first sign-in | a new account sees the trips, chats, activity |
| 24 | per-trip spending cap | three caps persist |
| 25 | floating chat launcher on every app page | recent chats listed, New chat works |
| 26 | polish: Connect buttons for upcoming channels, robot icon, empty composer placeholder | in browser |
| 27 | delete past chats | thread and its messages removed, list updates |
| 28 | reserve the scrollbar gutter so long pages do not shift content | same left edge on short and long pages |

Revised after commit 10 (2026-09-19): chat is the core product, so it gets
persistence and history, the home page becomes chat-first, and the visual
design lands before the chat UI is built.

### Notes on specific commits

**Commit 11.** One `AgentChannel` interface, a real `web` implementation, and
`whatsapp` and `imessage` adapters that throw `NotImplemented`. The
architecture is visible without building Twilio integration.

**Commit 15.** The chat is scripted. A small set of canned flows: plan a trip,
book a flight, ask about a delay. It needs to be convincing to a reviewer for
two minutes, not intelligent.

**Commit 18.** This is the screen that matters most for later. A monthly list
of agent transactions with a running count. Build it as a plain activity log.
Do not add any notion of a limit, an allowance, or a remaining balance.

**Commit 20.** Static marketing copy: Free (planning and inspiration), Plus
at $29/mo (booking and monitoring, with a monthly allowance of agent actions
described in prose), Pro at $99/mo (proactive concierge, auto-rebook), and a
Concierge Pass at $100 per trip for people who do not want a membership. No
database reads, no auth checks, no plan enum, no buttons that do anything.
Writing the pricing promise before the billing exists is realistic and it
constrains the later implementation.

## Schema at end of Stage 1

```
users               id, clerk_id, email, name, created_at

destinations        id, user_id, name, country, notes, archived_at

trips               id, user_id, destination_id, status,
                    starts_at, ends_at

trip_segments       id, trip_id, kind, carrier, ref,
                    depart_at, arrive_at, status

agent_settings      user_id, auto_rebook, per_booking_cap_cents,
                    per_trip_cap_cents, monthly_cap_cents,
                    allowed_channels

conversations       id, user_id, trip_id, title, created_at

messages            id, conversation_id, role, body, created_at

agent_transactions  id, user_id, trip_id, kind, amount_cents,
                    currency, description, occurred_at
```

`agent_transactions.kind` is one of `booking`, `rebooking`, `cancellation`.

No `billable` flag. No `reported_at`. No `plan_id`. Those arrive later as a
migration against this schema, and that migration is part of the point.

## Definition of done

A reviewer can sign in, save a place under Inspiration, see two trips, change
agent settings from the account menu, read past chats, have a scripted
conversation that books something, watch a delay trigger a rebook, and see
all of it in a monthly activity list with a running count. Deployed on
Vercel. Twenty-eight commits. Zero mentions of money anywhere
in the codebase except static copy on the pricing page.

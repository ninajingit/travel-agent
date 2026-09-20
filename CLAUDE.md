# Mira

An AI travel agent that plans trips, books them, and monitors them. Web app
plus a chat surface.

Read `PERSONA.md` before writing any user-facing copy.
Read `PLAN-STAGE2.md` for the commit-by-commit build plan.
`PLAN-STAGE1.md` is history: how the application was built with no billing
awareness. Do not reopen it.

## Current stage

**Stage 2 is complete and is what ships. Commits 33 to 58.**

Stage 1 built the product with no billing awareness, commits 1 through 31.
Phase A retrofitted memberships, the Concierge Pass, the ten-day Pro trial,
and the gates that make the pricing page true, commits 33 to 50. Phase B
made Mira charge the saved card for what it books, with caps enforced,
refunds, and one history, commits 51 to 58.

`PLAN-STAGE3.md`, paying with the traveller's Link wallet, is researched and
deferred. Do not build toward it. Any further work is a fix to Stage 2, and
follows the rules below.

## Hard rules

- **Stripe owns money. Postgres owns product state.** Stripe is the source of
  truth for customers, subscriptions, invoices, and payments. The app keeps a
  small mirror written by webhooks.
- **No Stripe call in a page render.** Every page and every gate reads the
  mirror tables. If a screen needs a Stripe call to draw itself, stop and say
  so.
- **Entitlement lives in one place.** `getEntitlement(userId)` answers plan,
  period bounds, actions used and allowed, and which trips have a pass. Chat,
  rebook, settings, activity, membership, and pricing ask it and nothing
  else. No second source of plan truth, no `is_premium` flag.
- **Billing code lives under `src/lib/billing`.** The Stripe client, the
  catalog, the entitlement function, and the webhook handlers. Product code
  imports from there and never imports `stripe` directly.
- `agent_transactions` stays a product record. No `billable`, no
  `reported_at`, no plan reference. Phase B adds `stripe_payment_intent_id`
  and nothing else.
- **Secrets only through env.** `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` are read server-side from `process.env`. Never
  checked in, never logged, never sent to the client.
- **The webhook is idempotent.** Every event id is stored before it is
  handled. Replaying an event changes nothing.
- **Nothing is charged over a cap.** The per-booking, per-trip, and monthly
  caps in `agent_settings` are the most Mira may spend without asking. Over
  any of them, the agent describes the booking and waits for a yes. They are
  checked before the charge, every time, with no exceptions for a retry or a
  rebook.
- **Consent before the first booking charge.** Charging the card for a flight
  is a different purpose from charging it for a membership, and needs its own
  agreement, recorded with a timestamp. Never reuse the subscription mandate.
- **The money moves before the booking exists.** An off-session charge that
  fails, or that needs authentication, stops the booking. Mira says so and
  sends a link. There is never a booking nobody paid for, and never a silent
  failure.
- **Every charge has a row.** One `agent_transactions` row per charge,
  carrying its `stripe_payment_intent_id`. A charge the activity page cannot
  explain is the failure this whole stage exists to avoid.
- **One concern per commit.** Stop after each commit and wait for review
  before starting the next.
- Do not look ahead in the plan. Execute the commit you are on.

## Why the constraints

This repo is the basis for a written friction log about integrating Stripe.
Stage 1's value was that the application existed first, so the integration is
a genuine retrofit. Stage 2's value is that the retrofit is honest: the
seams where billing meets a product that did not expect it are the subject.
Do not smooth them over silently. When something is awkward, say so in the
review rather than inventing an abstraction that hides it.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Neon Postgres via the Vercel Marketplace, Drizzle ORM
- Clerk for auth
- Stripe: Billing, hosted Checkout, Customer Portal
- Vercel, US East

Do not add dependencies that are not needed for the current commit.

## Commit format

```
pay(35): add subscriptions, passes, and stripe events schema
pay(37): add checkout route for plus, pro, and the concierge pass
```

Stage 1 used the `app(NN)` prefix. Stage 2 uses `pay(NN)`.

## Working style

- Run the gate listed for the commit in `PLAN-STAGE2.md` before committing.
- Keep migrations forward-only and checked in.
- Prefer boring, legible code. This repo gets read by an interviewer.
- If a decision has two reasonable answers, surface both and let the human
  choose rather than picking silently.
- The `neon-http` driver has no transactions. Say so when a handler wants
  one, and use insert-on-conflict instead of pretending.

# Passage

An AI travel agent that plans trips, books them, and monitors them. Web app
plus a chat surface.

Read `PERSONA.md` before writing any user-facing copy.
Read `PLAN-STAGE1.md` for the commit-by-commit build plan.

## Current stage

**Stage 1: application only. Commits 1 through 27.**

Payments are a later stage, run in a separate session. They are explicitly out
of scope right now.

## Hard rules

- **No billing concepts.** No Stripe dependency, no plan or tier column, no
  subscription table, no paywall, no feature gating, no upgrade CTA, no
  `is_premium` flag, no placeholder billing routes. Not commented out either.
- If something appears to need a billing concept, **stop and say so**. Do not
  add it speculatively and do not leave a TODO for it.
- `agent_transactions` is a product record only. It has no billing meaning
  yet. No `billable`, no `reported_at`, no plan reference.
- The pricing page (commit 20) is static marketing copy. It must not read from
  the database, check auth, or link to anything functional.
- **One concern per commit.** Stop after each commit and wait for review
  before starting the next.
- Do not look ahead in the plan. Execute the commit you are on.

## Why the constraints

This repo is the basis for a written friction log about integrating Stripe.
The value of that log depends on the application existing first, with no
billing awareness baked in, so that the integration is a genuine retrofit
rather than filling in prepared blanks. Anticipating the payments work
destroys the exercise.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Neon Postgres via the Vercel Marketplace, Drizzle ORM
- Clerk for auth
- Vercel, US East

Do not add dependencies that are not needed for the current commit.

## Commit format

```
app(06): add destinations schema and API routes
app(11): add agent channel interface with web, whatsapp, imessage adapters
```

## Working style

- Run the gate listed for the commit in `PLAN-STAGE1.md` before committing.
- Keep migrations forward-only and checked in.
- Prefer boring, legible code. This repo gets read by an interviewer.
- If a decision has two reasonable answers, surface both and let the human
  choose rather than picking silently.

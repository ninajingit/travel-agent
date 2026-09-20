# Nomi

By Llama Inc.

An AI travel agent that plans trips, books them, and watches them. When a
flight slips or a fare drops on a refundable ticket, the agent rebooks
without being asked.

This repo is the web app and its chat surface. See `CLAUDE.md` for the
working rules, `PERSONA.md` for who we are building for and how the copy
should sound, and `PLAN-STAGE1.md` for the commit-by-commit build plan.

## Stack

Next.js App Router, TypeScript, Tailwind. Neon Postgres with Drizzle ORM.
Clerk for auth. Deployed on Vercel, US East.

## Local development

```
npm install
cp .env.example .env.local   # fill in as variables are introduced
npm run dev
```

The app serves on http://localhost:3000.

## Deployment

Vercel builds from `main`, region `iad1`. `vercel.json` runs `npm run
db:migrate` before `next build`, so a deploy applies any new migration in
`drizzle/` to the database it is about to serve. Environment variables:
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` come from the Neon integration;
the two Clerk keys are set on the project by hand.

## Scripts

- `npm run dev` start the dev server
- `npm run build` production build and type check
- `npm run lint` ESLint
- `npm run db:generate` write a migration from `src/db/schema.ts`
- `npm run db:migrate` apply pending migrations
- `npm run db:seed` upsert the demo account named by `SEED_EMAIL` (sign up in the app first)

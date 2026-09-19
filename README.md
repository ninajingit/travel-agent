# Passage

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

## Scripts

- `npm run dev` start the dev server
- `npm run build` production build and type check
- `npm run lint` ESLint

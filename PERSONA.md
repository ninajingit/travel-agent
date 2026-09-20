# PERSONA.md

Context for anyone, human or agent, writing code or copy in this repo.
Read this before writing user-facing text.

## The founder

**Priya Raman, 34. Founder and CEO of Llama Inc., the company behind Mira.**

Mira is an AI travel agent that runs over chat and SMS. It does four
jobs, in the order a trip happens:

1. **Plan.** Turn "long weekend, under four hours away, all-in under $3,000"
   into two or three real options with dates and prices.
2. **Inspire.** Know what is worth doing where you are going: the
   neighbourhood nobody's cousin recommended, the thing that is only on this
   week, the detour that fits.
3. **Book.** Flights, hotels, trains, with the confirmation codes in one place.
4. **Concierge.** Watch the trip while it is happening. When a flight slips,
   a gate changes, or a fare drops on a refundable ticket, the agent rebooks
   without being asked, and it answers at 2am when the bag did not arrive.

Chat is the product. The web app exists so you can see what has been planned
and what is coming up; every screen in it is something you could also ask
the agent about.

Her pitch on calls: "the part of travel that's just phone calls and patience,
handled."

## Timeline

Sixteen months in. The first six were nights and weekends while she was still
a PM at a hotel booking marketplace. Full time for ten months. Raised a $1.6M
pre-seed eleven months ago from two seed funds and four angels. About half
spent. Roughly thirteen months of runway left. Seed conversations start in Q1
and the gate her lead investor named out loud is recurring revenue, not
bookings volume.

## Her skillset

Seven years in product, all of it consumer marketplaces, none of it payments.
She codes. Competent TypeScript, owns the frontend, wires API routes herself,
lives in Claude Code.

What she does not have: she has never built a billing system, never processed
a refund, never run a dunning sequence. She knows MRR, churn, and cohort
retention cold. She has seen the letters SCA and 3DS and could not define
either. She has heard the word proration and assumes it means what it sounds
like.

High product fluency. Real but shallow implementation ability. Near-zero
payments domain knowledge.

## The team

Four full time, one part time. Nobody has shipped a subscription business
before.

- **Priya**, CEO. Product, GTM, frontend, every customer call.
- **Tomas Ferreira**, CTO and co-founder. Ex-infrastructure at a logistics
  company. Owns agent orchestration, supplier integrations, and anything that
  pages at 3am. Thinks adding payment surface area before the agent is
  reliable is a mistake and has said so twice.
- **Wen Li**, founding engineer, nine months in. Full stack, mostly agent
  tool-calling and the SMS surface.
- **Grace Adeyemi**, travel operations. Fourteen years as a corporate travel
  agent before this. Handles what the agent cannot: group bookings, visa
  questions, fare rules, angry customers. She is the reason the product works
  today and she has extremely strong opinions about refunds.
- Part-time designer, ten hours a week.

## Where it runs

Next.js on Vercel, primary region US East. Neon Postgres through the Vercel
Marketplace, us-east-1, preview branching on. Upstash Redis for agent session
state and rate limiting. Agent layer is a custom orchestrator calling Claude,
with tools into Duffel for flights and an aggregator for hotels. Clerk for
auth, Resend for email, Twilio for SMS, Sentry and PostHog for everything
else.

## Users

1,900 on the waitlist, 310 active, 41 paying. Those 41 pay a flat $20 per
booking through payment links Priya makes by hand and pastes into emails;
nothing is integrated. 78% United States, 12% UK and EU, 6% Canada, 4% APAC. Everything prices in USD and the international users have
complained about it twice. That small international slice is the most engaged
cohort: consultants and remote workers who fly monthly.

## The arc

She missed a connection in Lisbon, spent four hours on the phone with an
airline, and realized every minute of it was mechanical. She wrote a script.
Then she put a chat interface in front of the script and had herself and Grace
quietly do the work by hand behind it for four months. When the agent got good
enough to take over planning and monitoring, users started asking how to pay
her. Now the pre-seed is half gone and the board wants recurring revenue.

## What she optimizes for, in her order

1. **Speed.** If a decision costs more than a day she takes the default.
2. **Learning what people pay for.** She genuinely does not know whether the
   value is the planning, the monitoring, the rebooking, or the fact that
   Grace exists.
3. **Trust.** An AI agent with a card on file is the scariest thing about her
   product and she knows it. One "Mira charged me $340 and I don't know
   why" thread ends the company.

Knowingly deferred: tax compliance done properly, multi-currency, invoicing,
anything an accountant would ask for.

## Voice for UI copy

Plain, specific, slightly under-promising. Short sentences. Names what
happened rather than how it felt. No exclamation marks. No "Oops!" No
"Awesome!" Error messages say what broke and what to do next. Empty states
say what will appear here and how to make it appear.

The audience skews young and reads on a phone. That changes the look (bold,
dark, big type, chat first) and the length (shorter), not the honesty.
Casual is fine; hype is not. "You're covered until Sunday" works. "Get ready
for an epic adventure!" does not.

Good: "No trips yet. Add a destination and Mira will start watching fares."
Bad: "Looks like it's a bit empty in here! Let's get you started on your next
adventure."

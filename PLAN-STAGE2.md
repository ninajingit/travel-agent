# PLAN-STAGE2.md

Stage 2: payments for Mira with Stripe. **Complete.** Commits 33 to 55,
shipped 2026-09-19 and 2026-09-20.

Stage 1 built the product with no billing awareness. This stage retrofitted
memberships (Plus, Pro), a one-off Concierge Pass, a ten-day Pro trial, the
gates that make the pricing page true, and then, in Phase B, Mira paying for
what it books.

Commit 32 checked in the first draft of this plan. It also said it would
replace CLAUDE.md's Stage 1 no-billing rule and did not; commit 33 did that.

Every gate below was run. The plan is kept as written, with the tables
marking what shipped, because the gap between the plan and the build is the
interesting part.

## How it differed from the plan

- **Commit numbers moved twice.** 36 was meant to be the schema and became
  the reversal of a Free product created in the dashboard (D25). 39 was meant
  to be entitlement and became an urgent fix: the webhook route's import of
  the Stripe client threw at build time and failed the deploy of the whole
  site. Everything after each shifted by one.
- **There are two commits numbered 40**, one renumbering the plan and one
  adding the checkout check. An amend that should have replaced a commit
  added one instead. Left alone rather than rewritten.
- **Enforcing the spending caps was not in the plan at all.** It turned out
  they had never been enforced anywhere, in Stage 1 or Phase A. Phase B could
  not honestly move money without them, so commit 53 does it (D26).
- **Several first-draft checks passed vacuously** and had to be rewritten to
  assert on something real. `subscription_data` is a create-only parameter
  and is not on a retrieved Checkout Session, so asserting on it reads
  undefined and passes whatever the code does. The trial check now asserts on
  what Checkout will charge today.
- **Refunds ended up on the Activity page**, next to the charge being
  reversed, rather than anywhere the plan imagined.

## Not covered

Webhook signature verification has never run over HTTP. Everything else was
exercised against real Stripe objects, but this one needs `stripe listen` and
the local signing secret it prints. The idempotency half of that commit's
gate was covered separately by `npm run stripe:webhook-check`.

## What we are selling

From the pricing page, which is now a promise the code has to keep:

| Offer | Price | Grants |
|-------|-------|--------|
| Free | $0 | Planning, inspiration, saved places. Booking hands you links. |
| Plus | $29 / month | Mira books and watches trips. Ten agent actions per billing period. |
| Pro | $99 / month | Plus, plus auto-rebook, fifty actions, a person on the thread. |
| Concierge Pass | $150 one-off | Pro for one trip, from purchase until the trip ends. |

An agent action is a row in `agent_transactions`: a booking, a rebooking, or a
cancellation. Planning and watching are never counted.

**Free trial.** Ten days of Pro, free, before the first charge at the full
Pro price. Card collected up front. One per person. Decided 2026-09-19.

## Shape of the integration

- **Stripe owns money. Postgres owns product state.** Stripe is the source of
  truth for customers, subscriptions, invoices, and payments. The app keeps a
  small mirror (subscription status, period bounds, passes) so every page
  render is a local query and never a Stripe call. Webhooks keep the mirror
  current.
- **Stripe Checkout, hosted.** Subscription mode for Plus and Pro, payment
  mode for the Pass. Nothing card-shaped is rendered by us.
- **Stripe Customer Portal** for changing plan, updating the card, cancelling,
  and reading invoices. We link to it; we do not rebuild it.
- **Prices resolved by lookup key** (`plus_monthly`, `pro_monthly`,
  `concierge_pass`), so sandbox and live need only different API keys.
- **One webhook route**, raw body, signature verified, every event id stored
  before it is handled so redelivery is a no-op.
- **Entitlement in one place.** `getEntitlement(userId)` answers: plan,
  period bounds, actions used and allowed, which trips have a pass. Chat,
  rebook, settings, activity, and the membership page all ask it and nothing
  else.
- **API version pinned to `2026-08-26.dahlia`**, in the SDK client and on the
  webhook endpoint, so the payload shape does not drift under us.
- **Billing periods are item-level.** Stripe removed
  `current_period_start` and `current_period_end` from the Subscription
  object in `2025-03-31.basil`. Read them from
  `subscription.items.data[0].current_period_*`. Our mirror keeps them as
  subscription-level columns because we sell one item per subscription.
- **Flexible billing mode** is the default for new subscriptions since
  `2025-09-30.clover`. We take the default.
- **Customers v1.** `users.stripe_customer_id` points at a `Customer`, not an
  Accounts v2 account.

## Schema additions

As built, across migrations 0007 to 0009.

```
users               + stripe_customer_id (nullable, unique)
                    + trial_used_at (nullable)
                    + booking_consent_at (nullable)   [Phase B]

subscriptions       id, user_id, stripe_subscription_id, plan (plus | pro),
                    status (Stripe's status string, including trialing),
                    price_lookup_key, current_period_start,
                    current_period_end, trial_end, cancel_at_period_end,
                    created_at, updated_at

concierge_passes    id, user_id, trip_id, stripe_checkout_session_id,
                    stripe_payment_intent_id, amount_cents, currency,
                    purchased_at

stripe_events       id (Stripe event id), type, received_at, processed_at
```

`agent_transactions` is unchanged in Phase A. Phase B added
`stripe_payment_intent_id`, and nothing else: it is still a product record,
with no billable flag and no plan reference.

A cancellation row carries a **negative** amount and the **same**
`stripe_payment_intent_id` as the booking it reverses. That is the link
between the two without another column, it is what stops a charge being
refunded twice, and it makes the Activity total read as what a period cost
rather than what passed through it.

Note the existing column names the migration has to live with:
`agent_transactions.kind` and `.occurred_at` (there is no `created_at`), and
`trips.starts_at` / `.ends_at` are `date`, not timestamps.

## Phase A: memberships and the pass

Commits 33 to 50. **All shipped, all gates run.**

| # | Commit | Gate |
|---|--------|------|
| 33 | CLAUDE.md Stage 1 rules replaced with Stage 2 rules; this plan updated with the settled decisions | docs only |
| 34 | `stripe` SDK, server-side client pinned to the API version, env vars in `.env.example` and Vercel | a script lists products from the sandbox |
| 35 | catalog: `lib/billing/catalog.ts` resolves prices by lookup key; an idempotent script sets the keys on the existing prices and creates anything missing | script prints three prices by key, twice, with the same result |
| 36 | the Free product and its $0 price are archived; Free is the absence of a subscription (D25) | catalog syncs to three keys |
| 37 | schema: `stripe_customer_id`, `trial_used_at`, `subscriptions`, `concierge_passes`, `stripe_events` | migration applies on dev and prod |
| 38 | webhook route: signature check, idempotent event store, handlers for `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` | `stripe trigger` writes rows; replaying the same event changes nothing |
| 39 | the Stripe client is built on first use, so a missing key cannot fail the whole build | `next build` succeeds with STRIPE_SECRET_KEY unset |
| 40 | checkout: `POST /api/checkout` for `plus`, `pro`, or `pass` (with `tripId`); creates or reuses the Stripe customer; refuses with 409 and a Portal link if a subscription is already active or trialing | test card completes; subscription row appears via webhook; a second call returns 409 |
| 41 | entitlement: `getEntitlement(userId)` from the mirror tables plus this period's `agent_transactions` | free, plus, pro, and pass cases return the right numbers |
| 42 | membership page `/app/membership` in the avatar menu: plan, renewal date, actions used, passes, buttons to the Customer Portal via `POST /api/billing/portal` | in browser, all three states |
| 43 | pricing page goes live: each card gets a button; signed-out goes through sign-in and back to checkout; signed-in shows the current plan | click Plus, land on Stripe Checkout |
| 44 | return from checkout: success page confirms the session server-side and shows a waiting state if the webhook has not landed | refresh after purchase shows the plan |
| 45 | gates: chat booking on Free replies with links and an offer to start Plus; rebook on Free is refused; actions past the allowance are refused with the count | Free cannot book, Plus can until ten |
| 46 | auto-rebook requires Pro or a pass on the trip; settings page explains why the toggle is off | toggle disabled on Free and Plus |
| 47 | activity: "3 of 10 actions this period", period from the subscription, pass-covered actions labelled and not counted | matches rows |
| 48 | Concierge Pass on the trip page: buy, Covered badge, dates covered | purchase, trip shows Covered, its actions are free |
| 49 | lifecycle: `past_due` banner with a fix-your-card link, `canceled` drops to Free at period end, "ends on" copy when `cancel_at_period_end` | `stripe trigger` scenarios |
| 50 | trial: Checkout starts Pro with a ten-day trial once per person; `trialing` grants Pro; membership page and pricing page say when the first charge lands; `customer.subscription.trial_will_end` is handled | a new account gets Pro for ten days; the same account cannot start a second trial |

### Notes on the trial

- Stripe runs the clock: `trial_period_days: 10` on the Checkout session,
  status `trialing` until `trial_end`, then the first invoice at $99.
- The trial is Pro, so during it auto-rebook is available and the allowance
  is fifty. An agent with a card on file and auto-rebook on, for someone who
  has paid nothing yet, is exactly the trust risk the persona names. The
  caps apply as always; the copy must say the card is not charged until the
  date shown.
- One trial per person. Stripe does not enforce this across subscriptions,
  so the app records it: `users.trial_used_at`, set when the trialing
  subscription is first seen. A second Checkout for that person starts
  without a trial.
- Cancelling during the trial ends access at `trial_end`, not immediately.
- Switching plan in the Portal during a trial ends the trial and bills the
  new plan immediately. That is the configured behaviour
  (`trial_update_behavior: end_trial`), and the membership page should not
  promise otherwise.
- Stripe emails a reminder before a trial ends when that setting is on in
  the dashboard; the app does not need to send its own.

### Notes on the allowance

- The period is the subscription's billing period, read from the mirror.
  The Activity page counts a UTC calendar month today; commit 47 changes it.
- Free has no period, so it has no allowance and no count to show.
- Actions on a pass-covered trip never count, whatever the plan.
- A Pro to Plus downgrade is scheduled for period end, so nobody wakes up
  over the Plus limit mid-period. A Plus to Pro upgrade applies at once and
  the allowance becomes fifty immediately.

## Phase B: Mira charges the card for what it books

Decided and built on 2026-09-20, after Phase A shipped. This is the "two shapes of
money on one customer" problem: a membership invoice and agent-initiated
variable charges, on one saved card, in one readable history.

It is also where the persona's stated company-ending risk lives. An agent
with a card on file that charges $340 nobody can account for is the failure
mode; every decision below is chosen against it.

Commits 51 to 55. **All shipped, all gates run.**

| # | Commit | Gate |
|---|--------|------|
| 51 | CLAUDE.md Phase B rules replace the "deferred, do not build toward it" rule; this plan records the decisions | docs only |
| 52 | Checkout saves the card for later off-session use; consent copy says Mira will charge it for bookings inside your caps | payment method attached to the customer |
| 53 | `recordTransaction` charges an off-session PaymentIntent for the booking amount, stores `stripe_payment_intent_id`; a card that needs authentication produces a message with a link rather than a silent failure | charge appears on the customer; 3DS test card produces the message |
| 54 | cancellations refund | refund appears in Stripe |
| 55 | membership page shows one history: invoices and booking charges together | matches Stripe |

Note for commit 52: subscription-mode Checkout already saves the card for
subsequent invoices. Charging it for a booking is a different purpose, so it
needs its own consent, not a reuse of the subscription mandate.

## Sandbox, as it stands

Account `acct_1UHQUoIpD2s73ETA`, "Llama Inc. sandbox". Production host
`https://travel-agent-two-delta.vercel.app`.

| Object | Id |
|--------|-----|
| Plus product / price | `prod_VIAJqOsiIbtZp8` / `price_1UHZyYIpD2s73ETAwFZNEtGY` ($29/mo) |
| Pro product / price | `prod_VIAJUsOJr4TcrX` / `price_1UHZyjIpD2s73ETAYe02FeiQ` ($99/mo) |
| Pass product / price | `prod_VIAHx7Za882xno` / `price_1UHZwcIpD2s73ETADkqWfvdN` ($150 once) |
| Free product / price | `prod_VICZ6gAHgo2sOz` / `price_1UHcAbIpD2s73ETAHpQH9rlF` — **archived**, see D25 |
| Customer Portal configuration | `bpc_1UHbrmIpD2s73ETA6fr1gfJm` |
| Webhook endpoint | `we_1UHbroIpD2s73ETADIw57CAF` |

The three prices were created by hand; commit 35 gave them their lookup keys
(`plus_monthly`, `pro_monthly`, `concierge_pass`), and
`npm run stripe:catalog -- --sync` will do the same to a fresh account. The
Portal allows switching between Plus and Pro, prorates upgrades, schedules
decreases for period end, cancels at period end, shows invoices, and ends a
trial on plan change. The webhook endpoint answers in production.

The sandbox also holds the test data the gates left behind: one Plus
subscription, two Concierge Passes, a booking charge and its full refund.

## Things only Cory can do

Done:

1. ~~Stripe CLI installed and logged in.~~
2. ~~`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel, and
   `NEXT_PUBLIC_APP_URL` set for both local and production.~~ Without the
   last one, Checkout returned people to whatever was on localhost:3000.

Still outstanding:

3. A **Terms of service URL** in public business details. With one,
   `consent_collection` adds a checkbox Stripe records on the session
   itself, which is stronger evidence of the booking-charge agreement than
   our own timestamp. Stripe refuses the parameter without it.
4. Turn on the "trial ending" reminder email under Billing settings, and
   confirm Smart Retries and failed-payment emails are on.
5. Set the statement descriptor to `LLAMA INC` with the dynamic suffix
   `MIRA`, and set Checkout branding colours. Branding matters more than it
   looks: hosted Checkout takes one theme for everyone, so the dark palette
   is the only way it matches the app.
6. Stripe Tax: set the head office address and a product tax category, for
   threshold monitoring only. No registrations, no collection yet.
7. Turn on Adaptive Pricing so international customers see their own
   currency at Checkout.
8. Roll the test secret key that was pasted into a chat window on
   2026-09-19.
9. The Clerk application is still named **Passage**, so the sign-in screen
   reads "Sign in to Passage". It is dashboard configuration, which is why
   the rename commits never caught it.
10. Business details, and live account verification, before any of this
    leaves the sandbox.

## Decisions, settled 2026-09-19 and 2026-09-20

| # | Question | Answer |
|---|----------|--------|
| D1 | Checkout surface | Hosted Stripe Checkout. |
| D2 | Where the plan lives | Mirror table in Postgres written by webhooks; pages never call Stripe. |
| D3 | Allowance period | The subscription's billing period. |
| D4 | At the allowance limit | Refuse the action, show the count, offer Pro. |
| D5 | Pass and allowance | Actions on a pass-covered trip never count against a membership allowance. |
| D6 | Free trial | Ten days of Pro before the first Pro charge. |
| D6a | Card up front | Card collected at Checkout; the trial converts to paid unless cancelled. |
| D6b | Who gets the trial | Anyone starting Pro who has not had a trial. |
| D6c | Plus during the trial | Plus has no trial; the trial is the reason to pick Pro. |
| D6d | Trial allowance | Trial actions count against the fifty like any Pro period. |
| D7 | Upgrade prompts in chat | The agent offers Plus in the thread when a Free user asks it to book. |
| D8 | Stripe Tax | Threshold monitoring only. Head office and a product tax category; no registrations, no collection, no `automatic_tax`, no code. Revisit when a threshold alert arrives. |
| D9 | Failed renewal | `past_due` keeps access while Stripe retries; a banner asks for a new card. |
| D10 | Phase B in this stage | Decide after Phase A ships. |
| D11 | Catalog creation | Commit 35 ships an idempotent script that sets lookup keys on the three existing prices and creates anything missing. The same script recreates the catalog in live mode. |
| D12 | Pass refunds | No self-serve refund; support handles it. |
| D13 | Stripe MCP connector | Connected. Used for reads and for dashboard-shaped setup (Portal, webhook endpoint). The catalog stays a repo script so live mode is reproducible. |
| D14 | The 41 people paying $20 per booking through hand-made payment links | Grandfathered. They stay on links until they choose a plan. No code, no migration, no fourth offer. |
| D15 | Downgrade Pro to Plus mid-period | Scheduled at period end. The Portal is configured with `schedule_at_period_end` on `decreasing_item_amount`, so nobody lands over the Plus allowance mid-period. Upgrades apply immediately with proration. |
| D16 | Plan change during a trial | Ends the trial and bills the new plan immediately (`trial_update_behavior: end_trial`). |
| D17 | Who sends receipts, trial reminders, dunning email | Stripe. Dashboard toggles, no Resend templates in Stage 2. |
| D18 | Currency | Prices stay USD. Adaptive Pricing is on, so Checkout shows the customer's own currency. The mirror records what Checkout reports. |
| D19 | A member buying a Concierge Pass | Allowed. Entitlement takes the better of plan and pass, and pass actions never count. |
| D20 | A trip whose end date moves after a Pass is bought | Coverage follows `trips.ends_at`. The pass stores `purchased_at` and no end date. |
| D21 | A second Checkout while already subscribed | Refused. `POST /api/checkout` returns 409 with a Portal link. One subscription per person; plan changes happen in the Portal. |
| D22 | Statement descriptor | `LLAMA INC` with dynamic suffix `MIRA`. |
| D23 | Customer model | Customers v1. Accounts v2 is still preview for non-Connect accounts. |
| D24 | Stripe Invoicing | Unused. Subscription invoices come from Billing; there is no manual-invoice flow in Stage 2. |
| D10 (settled) | Phase B | Build it, commits 51-55, decided 2026-09-20 after Phase A shipped. |
| D26 | The spending caps were never enforced | Phase B enforces them, and enforces them by **asking**, not refusing. The pricing page says spending "never goes past the caps you set" and settings calls them "the most Mira may spend without asking first", so over a cap the agent describes the booking and waits for a yes. Refusing would be stricter than the copy promises and worse mid-trip. Worth stating plainly: through all of Stage 1 and Phase A these caps were decoration. Nothing compared a booking to them. The scripted $1,368 booking is already over the $500 default. |
| D27 | Consent to charge for bookings | Custom consent text on the Checkout page covering what Mira will charge, how the amount is decided, and the caps, plus `users.booking_consent_at` recording when they agreed. Stripe requires a record of the agreement kept. The subscription mandate is not reused: a membership charge and a flight charge are different purposes and the card networks treat them that way. |
| D28 | A booking whose charge fails | Charge first, book only once it clears. A card needing authentication produces a message with a link, and the booking happens when it clears. Slower than booking first, but there is never a booking nobody paid for, and never a silent failure. |
| D25 | Is Free a $0 subscription? | No. Free is the absence of a subscription. Tried the other way on 2026-09-19 and backed out the same hour: a $0 subscription puts Stripe in the signup path for people who pay nothing, counts every free signup as a new subscriber and every abandonment as churn in the numbers the board reads, and breaks the one-call hosted Checkout upgrade because Checkout creates a subscription rather than changing one. The Free product and price are archived in the sandbox. |

## Definition of done

**Phase A: met.** A new account is Free and can plan but not book. Plus goes
through Stripe Checkout with a test card and comes back to a membership page
showing the plan and the renewal date. Pro carries a ten-day trial, once per
person, and says when the first charge lands. Booking in chat writes an
action and Activity shows it against the period's allowance. A Concierge Pass
marks its trip Covered and its actions are not counted. The Customer Portal
changes the plan and cancels it, and the app reflects both without a deploy.
Lifecycle states each explain themselves.

Two things were proven differently from the plan. A trial converting was
checked by asserting Stripe's own trial state and charge amounts rather than
by moving a test clock. Failed-payment states were set on the mirror, because
Stripe will not put a working test card into `past_due` on demand, and the
mirror is what a real `invoice.payment_failed` writes.

**Phase B: met, and reconciled rather than eyeballed.** Against one test
account Stripe held four succeeded charges: a $1,368 booking, two $150
passes, and $29 for Plus. Gross $1,697, refunded $1,368, net $329. The
membership page's single history lists all four plus the refund as its own
line and nets to the same $329.

Along the way: a $1,368 booking against a $500 per-booking cap produced a
question rather than a charge; approving it charged the card and linked the
PaymentIntent to its row; Stripe's authentication-required test card turned
the same booking into a message with a working Checkout link and no booking
made; and refunding twice, refunding a cancellation, and refunding a booking
Mira never paid for are each refused with their own reason.

## What running it again needs

`npm run stripe:catalog -- --sync` makes a fresh account match the catalog.
The other checks are `stripe:webhook-check` (12), `stripe:entitlement-check`
(30), `stripe:checkout-check` (14) and `stripe:trial-check` (10). All of them
clean up after themselves.

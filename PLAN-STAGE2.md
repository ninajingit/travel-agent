# PLAN-STAGE2.md

Stage 2: add payments to Mira with Stripe. Commits 32 onward.

Stage 1 built the product with no billing awareness. This stage retrofits
memberships (Plus, Pro), a one-off Concierge Pass, and the gates that make the
pricing page true. Draft; the open decisions at the bottom are being settled
before commit 32 starts.

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
Pro price. Decided 2026-09-19. Details still open are D6a to D6d below.

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

## Schema additions

```
users               + stripe_customer_id (nullable, unique)

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

`agent_transactions` is unchanged in Phase A. Phase B (below) adds
`stripe_payment_intent_id`.

## Phase A: memberships and the pass

Commit prefix `pay(NN)`. One concern per commit; stop for review after each.

| # | Commit | Gate |
|---|--------|------|
| 32 | Stage 2 plan checked in; CLAUDE.md no-billing rule replaced with the Stage 2 rules | docs only |
| 33 | `stripe` SDK, server-side client, env vars in `.env.example` and Vercel | a script lists products from the sandbox |
| 34 | catalog: Plus and Pro recurring prices created, all three prices carry lookup keys, `lib/billing/catalog.ts` resolves them | script prints three prices by key |
| 35 | schema: `stripe_customer_id`, `subscriptions`, `concierge_passes`, `stripe_events` | migration applies on dev and prod |
| 36 | webhook route: signature check, idempotent event store, handlers for `checkout.session.completed`, `customer.subscription.created/updated/deleted` | `stripe trigger` writes rows; replaying the same event changes nothing |
| 37 | checkout: `POST /api/checkout` for `plus`, `pro`, or `pass` (with `tripId`); creates or reuses the Stripe customer; success and cancel URLs | test card completes; subscription row appears via webhook |
| 38 | entitlement: `getEntitlement(userId)` from the mirror tables plus this period's `agent_transactions` | free, plus, pro, and pass cases return the right numbers |
| 39 | membership page `/app/membership` in the avatar menu: plan, renewal date, actions used, passes, buttons to the Customer Portal via `POST /api/billing/portal` | in browser, all three states |
| 40 | pricing page goes live: each card gets a button; signed-out goes through sign-in and back to checkout; signed-in shows the current plan | click Plus, land on Stripe Checkout |
| 41 | return from checkout: success page confirms the session server-side and shows a waiting state if the webhook has not landed | refresh after purchase shows the plan |
| 42 | gates: chat booking on Free replies with links and an offer to start Plus; rebook on Free is refused; actions past the allowance are refused with the count | Free cannot book, Plus can until ten |
| 43 | auto-rebook requires Pro or a pass on the trip; settings page explains why the toggle is off | toggle disabled on Free and Plus |
| 44 | activity: "3 of 10 actions this period", period from the subscription, pass-covered actions labelled and not counted | matches rows |
| 45 | Concierge Pass on the trip page: buy, Covered badge, dates covered | purchase, trip shows Covered, its actions are free |
| 46 | lifecycle: `past_due` banner with a fix-your-card link, `canceled` drops to Free at period end, "ends on" copy when `cancel_at_period_end` | `stripe trigger` scenarios |
| 47 | trial: Checkout starts Pro with a ten-day trial once per person; `trialing` grants Pro; membership page and pricing page say when the first charge lands; `customer.subscription.trial_will_end` is handled | a new account gets Pro for ten days; the same account cannot start a second trial |

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
- Stripe emails a reminder before a trial ends when that setting is on in
  the dashboard; the app does not need to send its own.

## Phase B: Mira charges the card for what it books

Deferred until Phase A ships and is decided separately (D10). This is the
"two shapes of money on one customer" problem: a membership invoice and
agent-initiated variable charges, on one saved card, in one readable history.

| # | Commit | Gate |
|---|--------|------|
| 47 | Checkout saves the card for later off-session use; consent copy says Mira will charge it for bookings inside your caps | payment method attached to the customer |
| 48 | `recordTransaction` charges an off-session PaymentIntent for the booking amount, stores `stripe_payment_intent_id`; a card that needs authentication produces a message with a link rather than a silent failure | charge appears on the customer; 3DS test card produces the message |
| 49 | cancellations refund | refund appears in Stripe |
| 50 | membership page shows one history: invoices and booking charges together | matches Stripe |

## Things only Cory can do

1. Finish the Stripe sandbox setup guide items that need a human: business
   details, and later the live account verification.
2. Create the Plus and Pro recurring products, or approve commit 34 doing it
   by script.
3. Copy `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` into `.env.local` and
   into the Vercel project. The webhook secret for production comes from the
   endpoint created in the dashboard; local uses `stripe listen`.
4. Configure the Customer Portal in the dashboard: allow switching between
   Plus and Pro, allow cancel at period end, show invoices.
5. Install the Stripe CLI and log in, for local webhooks and `stripe trigger`.
6. Turn on the "trial ending" reminder email under Billing settings in the
   dashboard, so Stripe sends it rather than us.

## Decisions surfaced (default in bold)

| # | Question | Options |
|---|----------|---------|
| D1 | Checkout surface | **Hosted Stripe Checkout.** / Embedded Checkout inside the app's dark theme. / Payment Element and a custom form. |
| D2 | Where the plan lives | **Mirror table in Postgres written by webhooks; pages never call Stripe.** / Call Stripe on each request. |
| D3 | Allowance period | **The subscription's billing period.** / Calendar month, matching the Activity page today. |
| D4 | At the allowance limit | **Refuse the action, show the count, offer Pro.** / Allow and bill overage (metered). |
| D5 | Pass and allowance | **Actions on a pass-covered trip never count against a membership allowance.** / They count. |
| D6 | Free trial | **Decided: ten days of Pro before the first Pro charge.** |
| D6a | Card up front | **Card collected at Checkout; the trial converts to paid unless cancelled.** / No card; Stripe pauses or cancels the subscription at trial end and the app asks for a card. |
| D6b | Who gets the trial | **Anyone starting Pro who has not had a trial.** / Every new subscriber, including Plus, gets ten days of Pro and then drops to the plan they chose. |
| D6c | Plus during the trial | **Plus has no trial; the trial is the reason to pick Pro.** / Plus gets the same ten days. |
| D6d | Trial allowance | **Trial actions count against the fifty like any Pro period.** / Unlimited during trial. |
| D7 | Upgrade prompts in chat | **The agent offers Plus in the thread when a Free user asks it to book.** / Only the pricing page sells. |
| D8 | Stripe Tax | **Off, matching what the persona defers.** / `automatic_tax` on in Checkout. |
| D9 | Failed renewal | **`past_due` keeps access while Stripe retries; a banner asks for a new card.** / Drop to Free on the first failure. |
| D10 | Phase B in this stage | **Decide after Phase A ships.** / Commit to it now, which changes commit 37's Checkout config. |
| D11 | Catalog creation | **Commit 34 creates Plus and Pro by script and sets lookup keys on all three.** / Cory creates them in the dashboard; code only reads. |
| D12 | Pass refunds | **No self-serve refund; support handles it.** / Refund button on the trip until the trip starts. |
| D13 | Stripe MCP connector | **Not connected; Stripe CLI and docs only.** / Connect mcp.stripe.com for the session. |

## Definition of done, Phase A

A new account is Free and can plan but not book. Starting Plus goes through
Stripe Checkout with a test card and comes back to a membership page that
shows the plan and the renewal date. Starting Pro shows "Pro, trial, first
charge on <date>", and Stripe's test clock moved past that date turns it into
a paid Pro period. Booking in chat writes an action and
the Activity page shows "1 of 10 actions this period". Buying a Concierge
Pass on a trip marks it Covered and its actions are not counted. The
Customer Portal changes the plan and cancels it, and the app reflects both
without a deploy. `stripe trigger` for a failed payment shows the banner.

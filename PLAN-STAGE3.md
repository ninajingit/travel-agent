# PLAN-STAGE3.md

Stage 3: Mira pays with the traveller's Link wallet. Commits 59 onward.

**Deferred on 2026-09-20. Not part of the demo.** The app ships on Stage 2's
behaviour: card on file inside the caps, a chat question above them, Llama
Inc. as merchant of record. This plan is kept because the research is done
and the decisions are recorded, and it starts when three things exist that
do not today: a Link OAuth client for a hosted agent, a per-request limit
above $500, and an answer from Duffel on virtual cards. Four decisions were
settled and are marked below; the rest carry defaults. Nothing here is
built.

Stage 2 left Mira charging a card on file through Llama Inc.'s Stripe
account for everything it books. That works, and it makes Llama the merchant
of record for every flight: roughly 3% on money that was never ours, the
chargeback risk on the full fare, and a Stripe dashboard that reads as though
we sell airline tickets. Stage 3 moves the ordinary case, a traveller who is
awake and deciding, onto their own wallet, and keeps the card on file for the
one case that cannot wait for a human: a flight that slips at 2am.

## What was asked for, and what Link actually does

Four requirements came in. Two are Link features. Two are ours to build.

| Asked for | What Link offers | So |
|---|---|---|
| The traveller sets a limit the agent may spend on its own, and limits above which it must get approval, per agent | Today, Link approves **every** purchase; the developer docs say so twice. link.com lists "Granular agent controls: set controls for when your agent can spend with and without your approval" under **Coming soon**, alongside more payment methods and saved buying preferences. The traveller's Link account does already carry per-transaction, daily, and 30-day limits, readable via `user-info`, which apply on top of anything we do. | The autonomous tier is the card on file from Stage 2, gated by the caps the traveller already sets: the per-booking cap is the limit Mira may spend alone, and the per-trip and monthly caps are the limits above which it must ask. "Asking" becomes a Link approval. When Link ships its own controls, this is the rail they replace (D41). |
| Mira picks the right card for the merchant: the United card for United, the Amex for rentals | `payment-methods list` returns the wallet's cards with ids. `spend-request create --payment-method-id` charges a specific one. | Fully supported. Mira keeps a preference map and passes the id. |
| Link's approval shows the intent, and if what the agent is about to charge does not match what it told the traveller, stop and ask | Everything on the approval screen for a virtual-card request is **supplied by the agent**: `--context` (100+ characters), `--line-item`, `--total`, `--merchant-name` and `--merchant-url`. Link displays them and does not check them against anything. What Link does enforce is the **amount**: the one-time card cannot be charged above what was approved, and a higher charge comes back as `re_authorize`. Whether the card is bound to the named merchant is not documented; the docs say it "works at any seller that accepts cards online". | The check is ours, and it has to be, because the screen is only as honest as Mira. Mira records what it proposed before it spends, builds the spend request from that record, and refuses to proceed if the two disagree. After the fact, the spend request's actual charge is reconciled against the proposal. Merchant binding is a question for Stripe (Cory's list). |
| Mira calls Link and Link informs the traveller | Spend request → `approval_url` → push notification in the Link app → approve → one-time-use virtual card, valid 12 hours. Test mode returns card `4000009990001984` and charges nothing. | This is the core flow. |

Three constraints that shape everything below.

- **US consumers only.** 22% of users are outside the US and are the most
  engaged cohort. They keep the Stage 2 card-on-file path unchanged.
- **$500 per spend request**, $500 a day, $20,000 over 30 days, per agent
  integration, until Stripe raises them. The demo booking is $1,368. Nothing
  real goes through Link until the limit is raised, which is an email to
  agent-spend at stripe.com and a conversation, not a setting.
- **Hosted agents need a confidential OAuth client** issued by Stripe. Local
  development can use the CLI's device flow against Cory's own Link account
  in the meantime.

## Shape of the integration

- **Two rails, one policy.** `decidePayment(proposal)` answers one question:
  card on file, or Link. Card on file when the amount is at or under the
  per-booking cap and inside the per-trip and monthly caps. Link for
  everything else, and always for a traveller who has set the per-booking cap
  to zero. Travellers who have not connected Link, or cannot, get Stage 2's
  behaviour: card on file inside the caps, a question in chat above them.
- **A proposal before any spend.** Mira writes down what it is about to buy,
  for whom, for how much, and with which card, as a row, and every spend
  request is built from that row rather than from the words in the chat. The
  approval screen the traveller sees and the record Mira keeps are the same
  data. Drift between them is a bug, and the app treats it as one.
- **Link owns approval. Mira never asks for a card.** The chat hands over an
  approval link and waits. Denied, expired, and step-up outcomes each have
  their own sentence in Mira's voice.
- **The virtual card lives for one call.** It is retrieved into memory,
  handed to the supplier call, and gone. Never logged, never stored, never in
  a transcript, never in an error message. The record keeps the spend request
  id and the last four digits.
- **Link tokens are secrets.** Access and refresh tokens are encrypted at
  rest with a server-side key, refreshed before expiry, and revoked on
  disconnect.
- **The SDK, not the CLI, in production.** `@stripe/link-sdk` 0.6.0 is the
  credential-only TypeScript client and declares Node 20 or newer, which is
  what the app runs. The CLI is for local exploration only; its dependencies
  want Node 22. Commit 60 proves the SDK works from this project before
  anything else is built on it.
- **Supplier side is still stubbed.** The scripted agent does not really call
  Duffel. Stage 3 hands the virtual card to the same place the Stage 2 charge
  went, which is a recorded transaction. Whether Duffel accepts a Link virtual
  card is a question for Duffel and is on Cory's list.

## Schema additions

```
link_connections    id, user_id (unique), link_customer_id, email,
                    access_token_enc, refresh_token_enc, access_expires_at,
                    scope, connected_at, disconnected_at

agent_settings      + card_preferences jsonb
                        [{ match: { category: "airline" } | { merchant: "United" },
                           link_payment_method_id, label }]

spend_proposals     id, user_id, trip_id, conversation_id, message_id,
                    merchant_name, merchant_url, amount_cents, currency,
                    line_items jsonb, context, link_payment_method_id,
                    rail (card_on_file | link), status
                    (proposed | approved | denied | expired | executed |
                     flagged | cancelled), link_spend_request_id,
                    flagged_reason, created_at, resolved_at

agent_transactions  + spend_proposal_id
                    + link_spend_request_id
                    + card_last4
```

`stripe_payment_intent_id` stays and is null on Link-paid rows. A row has one
or the other, and the merged history reads which.

## Phase C: the wallet

Commit prefix stays `pay(NN)`. One concern per commit; stop for review.

| # | Commit | Gate |
|---|--------|------|
| 59 | This plan; CLAUDE.md gains the Stage 3 rules once the decisions are settled | docs only |
| 60 | `@stripe/link-sdk` installed; a script authenticates with the device flow, creates a **test-mode** spend request for $35, polls to approval, retrieves the test card into memory, prints only the last four | test card `…1984` last four printed; nothing else about the card on stdout or in any file |
| 61 | `link_connections` table; `/app/settings` gets Connect Link and Disconnect; OAuth authorization-code flow with PKCE; tokens encrypted at rest; refresh before expiry; `user-info` shown (name, Link's own limits) | connect in browser, settings shows the name and limits; disconnect revokes |
| 62 | Spending policy: `decidePayment()` routes by amount and connection using the existing three caps; the settings page says next to the per-booking cap that it is what Mira may spend without asking, and at Link connect time says the same again with the current number; Stage 2 `chargeForBooking` stays for the card-on-file rail | routing checks: under all caps → card, over any → Link, not connected → card + chat question, per-booking cap zero → always Link |
| 63 | Proposals: Mira writes a `spend_proposals` row before any spend; the chat message that describes the booking is generated **from** the row, not the other way round | booking in chat writes a proposal, and the message text matches the row field for field |
| 64 | Link spend request from a proposal: `context` from the proposal, line items, merchant, preferred card, `metadata.proposal_id`; approval link in chat; `POST /api/spend/[id]/poll` advances status; approved → card into memory → supplier call → transaction row with `link_spend_request_id` and `card_last4`; `report` outcome to Link | test-mode request approved in the Link app from the chat link; transaction row appears; no card number anywhere but memory |
| 65 | Outcomes: denied, expired, `requires_action` (each `next_action.type`), `re_authorize`, cancelled; a sentence for each in Mira's voice; nothing recorded on any of them | each status produces its sentence and no row |
| 66 | Intent check: before creating a request, the proposal and the request are compared field by field; after approval, the spend request's `amount` and `merchant` are compared to the proposal; any mismatch marks the proposal `flagged` with a reason, cancels the request, and asks in chat | a mutated amount is caught before the request is created; a mutated request is caught after |
| 67 | Review: Activity shows flagged proposals and Link-approved rows ("Approved in Link, Visa …1984"); the membership history marks Link-paid rows as paid directly to the supplier, not through Mira | reconciled by eye against `spend-request list` |
| 68 | Card preferences: settings lists Link payment methods; the traveller maps categories and named merchants to cards; `decidePayment` fills `link_payment_method_id` | a United booking carries the United card's id on the request |
| 69 | Auto-rebook stays on the card on file: the monitoring path never goes to Link, and the settings page says so next to the toggle | delayed-segment rebook under the caps charges the card; over any of them, asks in chat rather than sending a 2am approval |

## Notes on the policy

- There is no new cap (D30). The per-booking cap the traveller already has
  is the amount Mira may spend alone, and the per-trip and monthly caps are
  the limits above which it asks. Existing settings carry over and
  auto-rebook keeps working the day someone connects Link.
- The cost of that choice is stated rather than hidden: the default
  per-booking cap is $500, so a $500 booking can happen on the card on file
  with no approval the moment Link is connected. The connect screen therefore
  shows the current number and offers to change it before finishing, and the
  settings page says next to the cap that it is what Mira spends without
  asking.
- With Link, "asking" becomes a Link approval for connected travellers and
  stays a chat question for everyone else.
- Link's own limits on the traveller's account are read, shown, and
  respected, but never edited from Mira. They belong to the traveller and
  Link.

## What the traveller actually sees

Link's own example on link.com is a travel booking, which is convenient. The
approval screen shows: which agent is asking ("openclaw-jane wants to spend
$180"), the merchant name and domain ("Triplo", "triplo.com"), the line item
("Queen room", "New Orleans"), the amount, which card will be used ("Visa
Credit ····1234"), and Approve / Decline. Purchase history afterwards shows
the merchant, time, amount, status, card, and agent.

Every one of those fields except the agent name and the card is text Mira
sends. That is the whole reason the proposal row exists.

## Notes on intent

- The proposal is the contract. It is written before the chat message, and
  the chat message is rendered from it. That is the only way "what Mira said"
  and "what Mira is about to do" can be guaranteed to be the same thing.
- The check is deterministic equality on merchant, amount, currency, and line
  items. There is no tolerance. If the supplier's price moved between
  proposal and execution, Mira re-proposes; it does not quietly raise the
  amount, even though Link would let it with a second approval.
- Flagged proposals are never auto-resolved. They wait for the traveller.
- Link enforces the amount at the card. It does not, as far as the docs say,
  enforce the merchant. So the post-approval reconciliation compares the
  supplier's actual charge to the proposal's merchant as well as its amount,
  and a card used somewhere other than where the traveller was told is
  flagged even though Link would have allowed it.

## Not chosen: Stripe Issuing for agents

Stripe's other answer to "verify what the agent is buying" is Issuing for
agents: Llama would fund virtual cards, hand one to Mira per task, and get an
`issuing_authorization.request` webhook on every purchase attempt, with a two
second window to approve or decline against merchant category, amount, and
the task's metadata. That is intent verification enforced by Stripe at
authorization time rather than by Mira before it, and merchant category
controls would keep a travel card from ever paying a restaurant. It is not
chosen for Stage 3 because it solves supplier payment, not collection: Llama
still has to charge the traveller, which is the merchant-of-record problem
again. It is the right shape for the autonomous tier if that problem is
solved another way later, and it is noted here so nobody rediscovers it.

## Things only Cory can do

1. **Email agent-spend at stripe.com.** Ask for a confidential OAuth client
   for a hosted agent, and for the per-request limit to be raised above $500.
   Both are prerequisites for anything real; commit 60 can run without them.
2. **A Link account** for development, with at least two cards in it, so
   card preferences can be tested. Device-flow login is a browser step.
3. **Ask Duffel** whether a one-time-use virtual card is accepted as card
   details, and whether it needs the billing address Link returns.
3a. **Ask Stripe two things** in the same email: whether a Link virtual card
   is bound to the merchant named on the spend request or only to the
   amount, and the timeline for the "granular agent controls" that link.com
   lists as coming soon, since that is the feature that would replace our
   card-on-file autonomous rail.
4. **A key for encrypting Link tokens at rest**, generated and placed in
   `.env.local` and Vercel as `LINK_TOKEN_KEY`.
5. Node 22 locally if you want the CLI for exploration. The app itself stays
   on Node 20 and uses the SDK.

## Decisions surfaced (default in bold)

| # | Question | Options |
|---|----------|---------|
| D30 (settled) | What counts as autonomous | **Reuse the per-booking cap.** Existing settings carry over and auto-rebook keeps working on day one. Chosen over a new cap defaulting to zero; the connect screen shows the current number so it is a conscious carry-over. |
| D31 (settled) | Merchant of record for Link-paid bookings | **The supplier.** Llama's Stripe account is not involved; the row carries `link_spend_request_id`, no PaymentIntent, and no Stripe refund. Cancelling a Link-paid booking is a supplier conversation and the Stage 2 refund button does not apply to those rows. |
| D32 | Travellers who cannot or do not connect Link | **Stage 2 behaviour unchanged**: card on file inside the caps, a chat question above them. / Refuse to book above the caps without Link. |
| D33 | Development before the OAuth client arrives | **Device-flow login with Cory's Link account**, tokens in `.env.local`, test-mode spend requests only. / Wait for the client. |
| D34 | The $500 per-request limit while it stands | **Test with amounts under $500**, and the gates use $35 and $420 bookings. / Block Stage 3 until the limit is raised. |
| D35 (settled) | Price drift between proposal and execution | **Re-propose.** Nothing is charged at a number the traveller did not see. Link's raise-amount with a second approval is not used. |
| D36 | Where card preferences come from | **The traveller sets them by hand** in settings. / Infer from Link Financial Insights summaries, which needs extra scopes and a second consent. |
| D37 | Token encryption | **AES-GCM with a server-side key in env.** / Store plaintext behind database access control. |
| D38 | Chat approval hand-off | **A link in the chat plus the Link push notification.** / Also poll and post a follow-up message in chat when the status changes, which needs a background job the app does not have. |
| D39 (settled) | Auto-rebook above the caps | **Ask, in chat, and wait**, even at 2am. They wake to a question, not a charge. |
| D40 | The `report` command | **Call it after every attempt**, success or not, since it costs nothing and Stripe uses it to improve agent checkout. / Skip. |
| D41 | When Link ships granular agent controls | **Retire the card-on-file autonomous rail for connected US travellers** and let Link hold the "spend without approval" threshold, since that puts the control in the wallet the traveller already trusts. `decidePayment()` is built as the one seam this changes. / Keep both, with Mira's caps as a second ceiling. |

## Definition of done

A connected US traveller asks Mira to book a $420 hotel. Mira writes a
proposal, tells them what it is about to do in words rendered from that
proposal, and sends a Link spend request built from the same row with their
preferred hotel card. Their phone buzzes. They approve in the Link app. The
chat says it is booked, Activity shows "Approved in Link, Visa …1984", and
the membership history marks the row as paid to the supplier, not to Mira.
The same booking at $35 with the per-booking cap at $50 charges the card on
file with no approval. A proposal whose amount is changed after it is
written is flagged and never sent. A denied request, an expired one, and a
step-up each produce their own sentence and no row. A delayed flight rebooks
on the card on file when under the cap and asks when over it. None of this
touches Llama Inc.'s Stripe balance, and no card number appears in any log,
row, or message.

# Local currency on the pricing page

Researched 2026-09-20. Not built. Every claim below was measured against
the sandbox `acct_1UHQUoIpD2s73ETA`, not read off a docs page.

## What we want

A currency control at the top of the pricing page, defaulting to the
visitor's country. The USD price stays the headline and stays the source of
truth. Under it, the same price in their currency, as an estimate. Then the
ability to pay in that currency.

## What Stripe has today

Three ways to localise a price. They do not overlap the way you would hope.

| | Adaptive Pricing | FX Quotes API | Manual currency prices |
|---|---|---|---|
| Shows a local price **on our page** | no | **yes** | yes |
| Works with **Checkout and subscriptions** | **yes** | no | **yes** |
| Who picks the number | Stripe | us | us |
| Cost | customer pays 2–4% | 1% FX fee, +0.2% to lock a day | 0%, we carry the FX risk |
| Effort | a dashboard toggle | a scheduled job | a scheduled job plus catalog churn |

Read the first two rows together. Nothing has a "yes" in both.

### What was measured

`POST /v1/fx_quotes` works on our sandbox today. It needs the header
`Stripe-Version: 2025-07-30.preview`; on our pinned `2026-08-26.dahlia` the
URL does not exist at all. One call returns every currency we ask for:

```
to_currency=usd  from_currencies[]=eur&gbp&jpy&cad&aud&inr&brl&sgd
```

For each it gives `exchange_rate` (Stripe's rate, 1% fee included),
`base_rate` (mid-market, no fee), and `reference_rate` (the ECB's published
rate, for showing alongside). A `lock_duration` of `five_minutes`, `hour` or
`day` holds the rate, and `day` cost 0.2% on top. The lock breaks early if
the market moves more than 3.5%, and `fx_quote.expired` fires when it does.

The quote will not attach to anything we sell:

```
POST /v1/checkout/sessions  fx_quote=fxq_...   ->  Received unknown parameter: fx_quote
POST /v1/subscriptions      fx_quote=fxq_...   ->  Received unknown parameter: fx_quote
```

It attaches to PaymentIntents and Transfers only. Mira sells subscriptions
through hosted Checkout, so for us the FX Quotes API is a display tool and
nothing more.

Manual currency prices do work end to end. A price created with
`currency_options[eur][unit_amount]=8728` produced a Checkout Session with
`currency=eur` and `amount_total=8728`. The number we set is the number
charged, exactly.

But the amounts are write-once:

```
POST /v1/prices/:id  currency_options[eur][unit_amount]=8899
  -> You are attempting to update an immutable field for an existing
     currency in currency_options.
```

A new currency can be added to an existing price. An amount already set can
never be changed. So refreshing a rate means creating a new price and moving
the lookup key to it. Our catalog already resolves by lookup key, so that
part costs us nothing. Two smaller traps: `currency_options` is absent from
a price unless you ask for `expand[]=currency_options`, and `stripe-node`
22.6.2 has no `fxQuotes` resource and no `FxQuote` type, so the call goes
through `client.rawRequest()` and we describe the response shape ourselves.

### What the customer actually pays

Adaptive Pricing is already switched on for this account. That was on the
list of things Cory still had to do; it is done.

The `+location_XX` email trick creates a Checkout Session that renders as if
the visitor were in that country. Opening three of them for $99 Pro:

| Country | Checkout shows | Rate Stripe discloses on the page |
|---|---|---|
| Germany | €89.68 per month | 1 USD = 0.9058 EUR |
| United Kingdom | £76.89 per month | 1 USD = 0.7767 GBP |
| Japan | ¥16,168 per month | 1 USD = 163.3133 JPY |

Compare each against the mid-market rate from the FX Quotes API, taken the
same hour:

| Currency | Mid-market USD→local | Adaptive Pricing | Markup |
|---|---|---|---|
| EUR | 0.87103 | 0.90580 | 3.99% |
| GBP | 0.74680 | 0.77670 | 4.00% |
| JPY | 156.84601 | 163.31330 | 4.12% |

Adaptive Pricing is charging the top of its published 2–4% band, and doing
it consistently. That is the number we needed. The estimate is

```
local estimate = usd_amount / base_rate * 1.04
```

which reproduces all three to the cent. It is a measured constant, not a
guess, and the check script in `pay(64)` re-measures it so we find out if
Stripe moves it.

Two more things the checkout page does that our page should acknowledge.
It prints the rate it used, in plain words, under the price. And it offers a
USD toggle, so anyone who would rather not take the conversion can decline
it. Our copy should say both.

## The gap, and the suggestion for Stripe

**Stripe prints its exchange rate on the checkout page and will not tell an
API what it is.**

"1 USD = 0.9058 EUR" is rendered, in words, above the payment form. It is not
on the Checkout Session object, not on the Price, not anywhere in the API
before the payment completes. The only way we obtained it was to build a
session, open it in a browser, and read it off the screen.

Adaptive Pricing is one toggle and handles a hundred currencies, but it
decides the currency and the rate inside the checkout page, where our
marketing site cannot see it. The FX Quotes API hands us exactly the rate we
want to publish, then refuses to attach to the product we actually sell. The
only way to make the displayed number true is manual currency prices, which
means running our own FX job, creating a new price on every refresh, and
carrying the rate risk Adaptive Pricing exists to absorb.

Either of these closes it, and the first is much smaller:

1. **Put the number Stripe already displays into the API.** Given a price and
   a country, return the presentment currency, the rate, and the amount
   Adaptive Pricing would show. Display only, no commitment, no lock. This is
   not new computation. Stripe does the work and shows the result to the
   customer; it just never says it to the merchant.
2. **Let `fx_quote` attach to a Checkout Session or a subscription.** Then
   the rate we displayed is the rate charged, and the existing 24-hour lock
   already covers a normal checkout.

Worth saying plainly in the log: the docs page comparing the three options
lists "Customers can see localized prices on your website and at checkout"
under FX Quotes API, directly above a row listing its supported integrations
as Payment Intents, Transfers and Connect. Both statements are true. Read
together they promise something that does not exist for anyone selling
subscriptions.

## How we would build it

The hard rule in CLAUDE.md decides the architecture for us: no Stripe call in
a page render. The pricing page cannot fetch a rate. So rates get mirrored
into Postgres by a scheduled job and the page reads the mirror, the same
shape as subscriptions and passes.

Geolocation needs no dependency. Vercel sets `x-vercel-ip-country` on every
request and `headers()` reads it. Fall back to `Accept-Language`, then to
USD.

| Commit | Concern |
|---|---|
| `pay(63)` | `fx_rates` mirror table and its migration |
| `pay(64)` | read FX quotes through `rawRequest`, plus a `stripe:fx-check` script |
| `pay(65)` | the scheduled refresh that writes the mirror |
| `pay(66)` | work out the visitor's currency from country, with a cookie override |
| `pay(67)` | show the local estimate under the USD price |
| `pay(68)` | the currency dropdown |
| `pay(69)` | charge in the chosen currency, per D43 |

Commits 63 to 68 are the same whichever way D43 goes. Only 69 depends on it,
so the decision does not block the start.

## Decisions

**D42. Which rate do we publish? Settled: mid-market, plus 4%.**
`base_rate` from the FX Quotes API, multiplied by 1.04. Measured against
three live checkout pages and correct to the cent on all three. Publishing
the mid-market rate on its own would read 4% light, and an estimate that
comes in under the real charge is the wrong way round for this product.
Re-measured by `stripe:fx-check` so a change on Stripe's side surfaces as a
failing check rather than as a support ticket.

**D43. How do we charge? Settled: Adaptive Pricing. Cory, 2026-09-20.**
USD stays the price and stays what we settle in. Stripe converts at
checkout, the customer may pay in local currency or toggle back to USD, and
we receive $99 either way. No manual currency prices, no new price objects,
no FX risk on our side. The cost is that the number on our page is an
estimate, and the page has to say so.

**D44. Lock duration and refresh cadence. Settled: no lock, refresh daily.**
A lock only pays for itself if the locked rate is the one charged, and it
cannot be: Adaptive Pricing re-converts at checkout whatever we display. So
`lock_duration: none`, which is free, and a daily refresh. The 0.2% a
24-hour lock costs would buy nothing.

**D47. Does a subscriber's currency ever change? No.** Adaptive Pricing
fixes the presentment currency when the subscription is created and uses it
for every off-session renewal after that. The amount in that currency moves
with the rate, so a German subscriber's bill is about €89.68 this month and
some other number next month. Stripe says exactly this on the checkout page:
charges will vary based on exchange rates. Our copy has to say it too, or
the first renewal that differs becomes a support ticket.

**D48. Tax. Resolved by the setup we already have.** Our prices are
tax-inclusive, and Stripe Tax calculates on the USD price before any
conversion. With inclusive behaviour the converted figure is the total the
customer pays, tax already in it. So the estimate we publish is the all-in
number and needs no tax caveat. This would not be true if we were
tax-exclusive, where VAT is added on top after conversion and the estimate
would understate the total by the local rate.

## Still open

**D45. Which currencies go in the dropdown?** Adaptive Pricing covers over a
hundred. We should list the ones we have customers in and let the rest fall
back to USD, because every currency on the list is one we have to be able to
talk about. Needs the actual customer countries to answer.

**D46. Rounding.** €89.68 is exact and looks computed. "About €90" reads
like a price and is honest about being an estimate. Leaning to the second,
given the number moves daily anyway, but it is a copy call.

## Things only Cory can do

- Decide whether the FX Quotes preview API version is acceptable in
  production code. It is a preview, `2025-07-30.preview`, and preview
  surfaces move. It is the only way to read a rate from Stripe, so the
  alternative is a non-Stripe rate source, which would drift from what
  Checkout charges and defeat the point.
- Answer D45 with the list of countries we actually have customers in.

Adaptive Pricing is already on, so that one is off the list.

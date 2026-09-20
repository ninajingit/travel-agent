import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { BASE_CURRENCY, QUOTED_CODES } from "./currencies";
import { stripe } from "./stripe";

/**
 * The FX Quotes API is still a preview surface. Our pinned version does not
 * have it at all: on 2026-08-26.dahlia the URL 404s with a hint telling you
 * to ask for a preview version. Passing the version per request keeps that
 * to this one call, so there is no second Stripe client and nothing else in
 * the app moves off the pinned version.
 */
export const FX_API_VERSION = "2025-07-30.preview";

/**
 * How much Adaptive Pricing adds to the mid-market rate at checkout.
 *
 * Stripe publishes this as a 2-4% band and does not say where in the band a
 * given transaction lands, so this number was measured rather than read.
 * On 2026-09-20, against live Checkout sessions for four countries, it was
 * the top of the band every time: 3.99% (EUR), 4.00% (GBP, KRW, BRL, DKK),
 * 4.12% (JPY). Mid-market times 1.04 reproduced all of them to the cent.
 *
 * This is a guess at someone else's fee, which is not a good thing for a
 * number in a codebase to be. It is here because Stripe does not expose the
 * rate Adaptive Pricing will use anywhere in the API; it only prints it on
 * the checkout page. `npm run stripe:fx-check` re-measures it against real
 * sessions so that a change on Stripe's side breaks a check instead of
 * quietly making every price on our site wrong.
 */
export const ADAPTIVE_MARKUP = 1.04;

/** One currency's rates, as Stripe reports them. */
export type Quote = {
  currency: string;
  /** Mid-market. 1 unit of `currency` in USD, e.g. 1 EUR = 1.14806 USD. */
  baseRate: number;
  /** The same rate carrying Stripe's own 1% FX fee. Stored, not displayed. */
  quotedRate: number;
  /**
   * The European Central Bank's published rate, which Stripe returns
   * alongside its own. Not stored and never shown. The check script uses it
   * to notice a Stripe rate that has gone obviously wrong, since an
   * independent second opinion is the only sanity test available.
   */
  referenceRate: number | null;
  stripeFxQuoteId: string;
};

type FxQuoteResponse = {
  id: string;
  rates: Record<
    string,
    {
      exchange_rate: number;
      rate_details: { base_rate: number; reference_rate: number | null };
    }
  >;
};

/**
 * Ask Stripe for today's rates for every currency we quote.
 *
 * One request covers all of them. `lock_duration: none` is deliberate and
 * free: a lock is only worth paying for if the locked rate is the one
 * charged, and it cannot be, because Adaptive Pricing re-converts at
 * checkout whatever we happen to be showing.
 */
export async function fetchQuotes(currencies: readonly string[] = QUOTED_CODES) {
  if (currencies.length === 0) return [];

  // stripe-node 22.6.2 has no fxQuotes resource and no FxQuote type, so this
  // goes through the SDK's escape hatch and we describe the shape ourselves.
  const response = (await stripe().rawRequest(
    "POST",
    "/v1/fx_quotes",
    {
      to_currency: BASE_CURRENCY,
      from_currencies: [...currencies],
      lock_duration: "none",
    },
    { apiVersion: FX_API_VERSION },
  )) as unknown as FxQuoteResponse;

  const quotes: Quote[] = [];
  for (const currency of currencies) {
    const rate = response.rates?.[currency];
    // A currency Stripe declines to quote is left out rather than stored as
    // zero. The page falls back to USD for anything missing from the mirror,
    // which is the right outcome: no estimate beats a wrong one.
    if (!rate) continue;
    quotes.push({
      currency,
      baseRate: rate.rate_details.base_rate,
      quotedRate: rate.exchange_rate,
      referenceRate: rate.rate_details.reference_rate ?? null,
      stripeFxQuoteId: response.id,
    });
  }
  return quotes;
}

/**
 * Fetch and write the mirror. Returns what it wrote.
 *
 * Upserts on currency, so running this twice in a minute leaves one row per
 * currency rather than two. `neon-http` has no transactions, so this is a
 * row at a time; a half-finished run leaves some currencies fresh and the
 * rest yesterday's, which is survivable because every row carries its own
 * fetched_at.
 */
export async function refreshRates(currencies: readonly string[] = QUOTED_CODES) {
  const quotes = await fetchQuotes(currencies);
  const written: Quote[] = [];

  for (const quote of quotes) {
    await db
      .insert(fxRates)
      .values({
        currency: quote.currency,
        baseRate: String(quote.baseRate),
        quotedRate: String(quote.quotedRate),
        stripeFxQuoteId: quote.stripeFxQuoteId,
      })
      .onConflictDoUpdate({
        target: fxRates.currency,
        set: {
          baseRate: String(quote.baseRate),
          quotedRate: String(quote.quotedRate),
          stripeFxQuoteId: quote.stripeFxQuoteId,
          fetchedAt: sql`now()`,
        },
      });
    written.push(quote);
  }

  return written;
}

/**
 * What we will tell someone a USD price costs in their currency.
 *
 * Mid-market, plus what Adaptive Pricing adds. Deliberately not rounded
 * here: JPY and KRW have no minor unit and EUR has two, and Intl knows the
 * difference, so formatting stays with whatever is doing the displaying.
 */
export function estimateLocal(usdCents: number, baseRate: number) {
  return (usdCents / 100 / baseRate) * ADAPTIVE_MARKUP;
}

/** Guards against a mirror row that a refresh has not touched in too long. */
export function isStale(fetchedAt: Date, maxAgeHours = 48) {
  return Date.now() - fetchedAt.getTime() > maxAgeHours * 60 * 60 * 1000;
}

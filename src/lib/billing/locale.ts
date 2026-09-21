import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { CURRENCY_COOKIE, DOLLARS_ONLY, type Quoted, quotedByCode, quotedForCountry } from "./currencies";
import { estimateLocal, isStale } from "./fx";

/**
 * The country Vercel worked out from the request, or null anywhere else.
 *
 * Vercel's edge sets this on every request. It is absent in `next dev`,
 * which is why local development always falls through to Accept-Language
 * and then to dollars.
 */
export async function requestCountry() {
  const head = await headers();
  const vercel = head.get("x-vercel-ip-country");
  if (vercel) return vercel.toUpperCase();

  return countryFromAcceptLanguage(head.get("accept-language"));
}

/**
 * The first country named in an Accept-Language header, or null.
 *
 * Nothing like as good as the Vercel header. "ja-JP" carries a country;
 * plain "ja" does not, and a language is not a country, so a bare tag is
 * ignored rather than guessed at. Split out from the request so it can be
 * tested without one.
 */
export function countryFromAcceptLanguage(value: string | null | undefined) {
  if (!value) return null;
  for (const part of value.split(",")) {
    const tag = part.split(";")[0]?.trim();
    const region = tag?.split("-")[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  }
  return null;
}

/**
 * The currency to show this visitor, and why.
 *
 * `null` means show dollars and nothing else, which is the right answer for
 * most of the world: we quote four currencies, not a hundred, and an
 * unconverted price beats a wrong one.
 */
export async function resolveCurrency(): Promise<{
  currency: Quoted | null;
  /** Where the answer came from, so the UI can say "we guessed" honestly. */
  source: "chosen" | "country" | "default";
}> {
  const jar = await cookies();
  const chosen = jar.get(CURRENCY_COOKIE)?.value;

  if (chosen === DOLLARS_ONLY) return { currency: null, source: "chosen" };
  if (chosen) {
    const match = quotedByCode(chosen);
    // An unrecognised cookie is ignored rather than trusted. It is user
    // input, and the list it has to match shrinks whenever we drop a
    // currency, which would otherwise leave old cookies pointing at nothing.
    if (match) return { currency: match, source: "chosen" };
  }

  const country = await requestCountry();
  const guess = quotedForCountry(country);
  if (guess) return { currency: guess, source: "country" };

  return { currency: null, source: "default" };
}

export type LocalPrice = {
  currency: Quoted;
  /** Ready to render, e.g. "￥16,168". Intl handles the minor units. */
  formatted: string;
  /** When the rate was last pulled, for anything that wants to say so. */
  asOf: Date;
};

/**
 * Several USD prices in one currency, against one rate lookup.
 *
 * Reads the mirror, never Stripe: this runs inside a page render. The
 * pricing page shows four offers at once, and asking the mirror once per
 * card would be four queries for one number.
 *
 * Returns null when there is no rate, or when the rate is old enough that
 * we would rather say nothing. A missing estimate costs us a nice touch. A
 * stale one quotes a number we cannot stand behind.
 */
export async function localPrices(
  amounts: readonly number[],
  currency: Quoted | null,
): Promise<Map<number, LocalPrice> | null> {
  if (!currency || amounts.length === 0) return null;

  const [row] = await db
    .select()
    .from(fxRates)
    .where(eq(fxRates.currency, currency.code))
    .limit(1);
  if (!row) return null;

  const rate = Number(row.baseRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (isStale(row.fetchedAt)) return null;

  const out = new Map<number, LocalPrice>();
  for (const cents of amounts) {
    out.set(cents, {
      currency,
      formatted: formatLocal(estimateLocal(cents, rate), currency),
      asOf: row.fetchedAt,
    });
  }
  return out;
}

/** One price. Same rules as localPrices, which it defers to. */
export async function localPrice(usdCents: number, currency: Quoted | null) {
  const prices = await localPrices([usdCents], currency);
  return prices?.get(usdCents) ?? null;
}

/** Intl knows JPY and KRW have no minor unit and DKK has two. We do not. */
export function formatLocal(amount: number, currency: Quoted) {
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code.toUpperCase(),
  }).format(amount);
}

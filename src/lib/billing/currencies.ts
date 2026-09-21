// The currencies the pricing page will quote, and the countries that pick
// them. Deliberately short. Every currency on this list is one we have to be
// able to explain when someone writes in about the number, so it grows when
// we have customers in a place, not before.
//
// USD is not in the list because it is not a choice. It is the price.
// Everything here is a second number shown underneath it.

/** What we price and settle in. Never converted, never estimated. */
export const BASE_CURRENCY = "usd";

/**
 * Where a visitor's own choice of currency is kept.
 *
 * A cookie rather than a query string, so the choice survives moving between
 * pages, and rather than the user row, so it works before anyone signs in,
 * which is where the pricing page lives.
 *
 * Lives here rather than next to the code that reads it, because the
 * dropdown that writes it runs in the browser and must not drag the server
 * half of this in with it.
 */
export const CURRENCY_COOKIE = "mira_currency";

/**
 * The cookie value meaning "dollars are fine, stop converting".
 *
 * Needed as a distinct value: an absent cookie means we have not been told
 * and should guess from the country. This means we have been told.
 */
export const DOLLARS_ONLY = "usd";

export type Quoted = {
  /** ISO 4217, lower case, the way Stripe writes it. */
  code: string;
  /** ISO 3166-1 alpha-2. The country whose visitors get this by default. */
  country: string;
  /**
   * The place. Used when explaining why we guessed this currency, never in
   * the picker: "You look like you are in Japan".
   */
  label: string;
  /**
   * The money. Used in the picker, because that is what someone is
   * choosing: "Japanese yen", not "Japan" and not "JPY".
   */
  currencyName: string;
  /** Passed to Intl.NumberFormat, which knows JPY and KRW have no decimals. */
  locale: string;
};

export const QUOTED: readonly Quoted[] = [
  { code: "jpy", country: "JP", label: "Japan", currencyName: "Japanese yen", locale: "ja-JP" },
  { code: "krw", country: "KR", label: "South Korea", currencyName: "Korean won", locale: "ko-KR" },
  { code: "brl", country: "BR", label: "Brazil", currencyName: "Brazilian real", locale: "pt-BR" },
  { code: "dkk", country: "DK", label: "Denmark", currencyName: "Danish krone", locale: "da-DK" },
];

export const QUOTED_CODES = QUOTED.map((c) => c.code);

/** The currency a visitor from this country sees, or null for the rest. */
export function quotedForCountry(country: string | null | undefined) {
  if (!country) return null;
  const upper = country.toUpperCase();
  return QUOTED.find((c) => c.country === upper) ?? null;
}

export function quotedByCode(code: string | null | undefined) {
  if (!code) return null;
  const lower = code.toLowerCase();
  return QUOTED.find((c) => c.code === lower) ?? null;
}

/** Everything the dropdown needs, dollars first because dollars is the price. */
export const CURRENCY_OPTIONS = [
  { value: DOLLARS_ONLY, label: "US dollars" },
  ...QUOTED.map((c) => ({ value: c.code, label: c.currencyName })),
];

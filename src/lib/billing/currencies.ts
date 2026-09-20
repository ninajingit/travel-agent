// The currencies the pricing page will quote, and the countries that pick
// them. Deliberately short. Every currency on this list is one we have to be
// able to explain when someone writes in about the number, so it grows when
// we have customers in a place, not before.
//
// USD is not in the list because it is not a choice. It is the price.
// Everything here is a second number shown underneath it.

/** What we price and settle in. Never converted, never estimated. */
export const BASE_CURRENCY = "usd";

export type Quoted = {
  /** ISO 4217, lower case, the way Stripe writes it. */
  code: string;
  /** ISO 3166-1 alpha-2. The country whose visitors get this by default. */
  country: string;
  /** What the dropdown says. A place, not a currency code. */
  label: string;
  /** Passed to Intl.NumberFormat, which knows JPY and KRW have no decimals. */
  locale: string;
};

export const QUOTED: readonly Quoted[] = [
  { code: "jpy", country: "JP", label: "Japan", locale: "ja-JP" },
  { code: "krw", country: "KR", label: "South Korea", locale: "ko-KR" },
  { code: "brl", country: "BR", label: "Brazil", locale: "pt-BR" },
  { code: "dkk", country: "DK", label: "Denmark", locale: "da-DK" },
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

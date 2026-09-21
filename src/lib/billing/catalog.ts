import { stripe } from "./stripe";

// Every price the app sells, addressed by lookup key rather than by price id.
// Lookup keys are stable across accounts, so sandbox and live differ only by
// which secret key is in the environment. Price ids do not survive the move.
//
// Free is not here on purpose. Free is the absence of a subscription, not a
// $0 one: it keeps Stripe out of the signup path, and it keeps free accounts
// out of the MRR and churn numbers. See D25 in PLAN-STAGE2.md.
export const LOOKUP_KEYS = {
  plus: "plus_monthly",
  pro: "pro_monthly",
  pass: "concierge_pass",
} as const;

export type CatalogKey = keyof typeof LOOKUP_KEYS;
export type LookupKey = (typeof LOOKUP_KEYS)[CatalogKey];

/** What the catalog is meant to contain. The sync script makes it so. */
export const CATALOG: Record<
  CatalogKey,
  {
    lookupKey: LookupKey;
    productName: string;
    unitAmount: number;
    recurring: boolean;
  }
> = {
  plus: {
    lookupKey: LOOKUP_KEYS.plus,
    productName: "Plus",
    unitAmount: 2900,
    recurring: true,
  },
  pro: {
    lookupKey: LOOKUP_KEYS.pro,
    productName: "Pro",
    unitAmount: 9900,
    recurring: true,
  },
  pass: {
    lookupKey: LOOKUP_KEYS.pass,
    productName: "Concierge Pass",
    unitAmount: 15000,
    recurring: false,
  },
};

const ALL_LOOKUP_KEYS = Object.values(LOOKUP_KEYS);

let cached: Map<LookupKey, string> | null = null;

/**
 * Throw away the cached price ids.
 *
 * Called when Stripe says a price changed. Without this the site would show
 * the new price and charge the old one until the next deploy, which is a
 * worse bug than the one the mirror was built to fix: at least a stale page
 * and a stale checkout agreed with each other.
 */
export function forgetPrices() {
  cached = null;
}

/**
 * Price ids for every lookup key, fetched once per server process. Prices are
 * immutable in Stripe and the catalog changes about once a year, so re-reading
 * them on every checkout would be a round trip for nothing. A deploy clears
 * it, and so does forgetPrices() when a price event arrives.
 */
export async function resolvePrices(): Promise<Map<LookupKey, string>> {
  if (cached) return cached;

  const { data } = await stripe().prices.list({
    lookup_keys: [...ALL_LOOKUP_KEYS],
    active: true,
    limit: 100,
  });

  const found = new Map<LookupKey, string>();
  for (const price of data) {
    if (price.lookup_key) found.set(price.lookup_key as LookupKey, price.id);
  }

  const missing = ALL_LOOKUP_KEYS.filter((key) => !found.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Stripe is missing prices for: ${missing.join(", ")}. ` +
        "Run `npm run stripe:catalog -- --sync` against this account.",
    );
  }

  cached = found;
  return cached;
}

/** The price id for one offer. Throws if the catalog is incomplete. */
export async function priceIdFor(key: CatalogKey): Promise<string> {
  const prices = await resolvePrices();
  const id = prices.get(LOOKUP_KEYS[key]);
  if (!id) throw new Error(`No price for ${LOOKUP_KEYS[key]}.`);
  return id;
}

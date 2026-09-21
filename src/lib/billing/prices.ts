import { sql } from "drizzle-orm";
import { db } from "@/db";
import { catalogPrices } from "@/db/schema";
import { CATALOG, LOOKUP_KEYS, forgetPrices, type CatalogKey } from "./catalog";
import { stripe } from "./stripe";

/**
 * What everything costs, copied from Stripe into Postgres.
 *
 * Before this, the figures lived in the pricing page, the upgrade prompt, the
 * pass button, the trip page, the switch page, and in a sentence Mira says
 * out loud in chat. Changing a price meant editing Stripe and then finding
 * all of them. Nothing failed when you missed one; the site simply started
 * quoting a number we would not charge.
 *
 * Stripe is still where a price is set. This is only a copy, kept current by
 * the webhook and refreshed nightly, because a page may not call Stripe.
 */

/** A price as we show it. */
export type CatalogPrice = {
  lookupKey: string;
  productName: string;
  unitAmount: number;
  currency: string;
  /** "month", or null for the one-off pass. */
  interval: string | null;
  stripePriceId: string;
};

/**
 * Read the live prices out of Stripe.
 *
 * By lookup key rather than price id, because ids change. "Adjusting a
 * price" in Stripe is not an edit: `unit_amount` is immutable, so the
 * Dashboard archives the old price and makes a new one. The lookup key is
 * the only name that survives that.
 */
export async function fetchCatalogPrices(): Promise<CatalogPrice[]> {
  const { data } = await stripe().prices.list({
    lookup_keys: Object.values(LOOKUP_KEYS),
    active: true,
    expand: ["data.product"],
    limit: 100,
  });

  const prices: CatalogPrice[] = [];
  for (const price of data) {
    if (!price.lookup_key || price.unit_amount === null) continue;
    const product = price.product;
    prices.push({
      lookupKey: price.lookup_key,
      productName:
        typeof product === "object" && product && !("deleted" in product)
          ? product.name
          : price.lookup_key,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
      stripePriceId: price.id,
    });
  }
  return prices;
}

/**
 * Copy Stripe's prices into the mirror. Returns what was written.
 *
 * Upserts on the lookup key, so running it twice changes nothing but the
 * timestamp. Prices that Stripe no longer returns are left alone rather than
 * deleted: an empty or partial response should not blank the pricing page.
 */
export async function refreshCatalogPrices() {
  const prices = await fetchCatalogPrices();

  // Checkout resolves price ids through a per-process cache. Refreshing the
  // mirror without clearing it would leave the site showing a new price and
  // charging the old one.
  forgetPrices();

  for (const price of prices) {
    await db
      .insert(catalogPrices)
      .values({
        lookupKey: price.lookupKey,
        stripePriceId: price.stripePriceId,
        productName: price.productName,
        unitAmount: price.unitAmount,
        currency: price.currency,
        interval: price.interval,
      })
      .onConflictDoUpdate({
        target: catalogPrices.lookupKey,
        set: {
          stripePriceId: price.stripePriceId,
          productName: price.productName,
          unitAmount: price.unitAmount,
          currency: price.currency,
          interval: price.interval,
          fetchedAt: sql`now()`,
        },
      });
  }

  return prices;
}

/**
 * Every price, keyed by our own name for it.
 *
 * Falls back to the amounts in CATALOG for anything the mirror has not seen,
 * so a fresh database renders the real page rather than a blank one. That
 * fallback is the last hardcoded figure in the app, and `stripe:price-check`
 * fails when it disagrees with Stripe.
 */
export async function getPrices(): Promise<Record<CatalogKey, CatalogPrice>> {
  const rows = await db.select().from(catalogPrices);
  const byKey = new Map(rows.map((row) => [row.lookupKey, row]));

  const out = {} as Record<CatalogKey, CatalogPrice>;
  for (const [key, entry] of Object.entries(CATALOG) as [
    CatalogKey,
    (typeof CATALOG)[CatalogKey],
  ][]) {
    const row = byKey.get(entry.lookupKey);
    out[key] = row
      ? {
          lookupKey: row.lookupKey,
          productName: row.productName,
          unitAmount: row.unitAmount,
          currency: row.currency,
          interval: row.interval,
          stripePriceId: row.stripePriceId,
        }
      : {
          lookupKey: entry.lookupKey,
          productName: entry.productName,
          unitAmount: entry.unitAmount,
          currency: "usd",
          interval: entry.recurring ? "month" : null,
          stripePriceId: "",
        };
  }
  return out;
}

/**
 * "$29", or "$29.50" when the cents matter.
 *
 * Whole dollars lose the ".00" because a pricing page reads better without
 * it, and every price we have ever sold has been whole dollars. The moment
 * one is not, this shows the cents rather than rounding them away.
 */
export function formatPrice(price: Pick<CatalogPrice, "unitAmount" | "currency">) {
  const major = price.unitAmount / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
  }).format(major);
}

/** "per month", or "per trip" for the pass. */
export function cadenceFor(price: Pick<CatalogPrice, "interval" | "lookupKey">) {
  if (price.interval) return `per ${price.interval}`;
  return price.lookupKey === LOOKUP_KEYS.pass ? "per trip" : "";
}

import type { Quoted } from "@/lib/billing/currencies";
import type { LocalPrice } from "@/lib/billing/locale";

/**
 * The second line under a price: roughly what it costs where you are.
 *
 * Quiet on purpose. The dollar figure is the price and stays the headline;
 * this is a translation of it, not a competing number. "About" is doing
 * real work rather than hedging: Stripe converts at checkout using its own
 * rate, and the figure here is our reconstruction of that rate, so it can
 * be a unit or two out and will move from one day to the next.
 */
export function LocalPriceLine({
  price,
  cadence,
}: {
  price: LocalPrice | null;
  cadence?: string;
}) {
  if (!price) return null;
  return (
    <p className="mt-1 text-sm text-muted">
      about {price.formatted}
      {cadence ? ` ${cadence}` : ""}
    </p>
  );
}

/**
 * Said once per page rather than once per card, because it is the same
 * sentence four times otherwise.
 *
 * `source` changes the first clause and nothing else. Telling someone who
 * picked Denmark from a menu that they look like they are in Denmark is
 * the sort of thing that makes a site feel like it is not listening.
 */
export function LocalPriceNote({
  currency,
  source,
}: {
  currency: Quoted;
  source: "chosen" | "country" | "default";
}) {
  return (
    <p className="mt-4 max-w-xl text-sm text-muted">
      {source === "chosen"
        ? `Showing estimates for ${currency.label}. `
        : `You look like you are in ${currency.label}, so there is an estimate under each price. `}
      The price is the dollar figure. At checkout Stripe converts it and charges
      you in your own currency at its rate that day, so the exact amount will
      differ a little from ours and will move month to month. You can choose to
      pay in dollars instead.
    </p>
  );
}

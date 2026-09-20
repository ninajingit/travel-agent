// Prints what the Stripe account holds, so you can see the catalog without
// opening the dashboard. Read only.
//
//   npm run stripe:catalog
import { stripe } from "@/lib/billing/stripe";

function money(amount: number | null, currency: string) {
  if (amount === null) return "—";
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

async function main() {
  const mode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live")
    ? "LIVE"
    : "test";
  console.log(`mode          ${mode}`);
  console.log("");

  const prices = await stripe.prices.list({ limit: 100, expand: ["data.product"] });
  if (prices.data.length === 0) {
    console.log("No prices. The catalog commit creates them.");
    return;
  }

  console.log("lookup key        price                           amount");
  for (const price of prices.data) {
    const product = price.product as { name?: string };
    const cadence = price.recurring ? `/${price.recurring.interval}` : " once";
    console.log(
      [
        (price.lookup_key ?? "(none)").padEnd(17),
        `${product.name ?? "?"} ${price.id}`.padEnd(31),
        `${money(price.unit_amount, price.currency)}${cadence}`,
      ].join(" "),
    );
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

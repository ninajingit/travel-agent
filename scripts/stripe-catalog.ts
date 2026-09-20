// Shows, and optionally repairs, the Stripe catalog for this account.
//
//   npm run stripe:catalog            prints what the account holds
//   npm run stripe:catalog -- --sync  sets lookup keys, creates what is missing
//
// --sync is idempotent: running it twice leaves the account the same. It is
// how the catalog gets recreated in live mode, so nothing here depends on a
// price id that only exists in the sandbox.
import type Stripe from "stripe";
import { CATALOG, type CatalogKey } from "@/lib/billing/catalog";
import { stripe } from "@/lib/billing/stripe";

function money(amount: number | null, currency: string) {
  if (amount === null) return "—";
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function mode() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "LIVE" : "test";
}

async function activePrices() {
  const { data } = await stripe().prices.list({
    active: true,
    limit: 100,
    expand: ["data.product"],
  });
  return data;
}

function productName(price: Stripe.Price) {
  const product = price.product as Stripe.Product | Stripe.DeletedProduct;
  return "name" in product ? (product.name ?? "?") : "(deleted)";
}

/** A price already shaped the way this entry wants, ignoring the lookup key. */
function matches(price: Stripe.Price, entry: (typeof CATALOG)[CatalogKey]) {
  return (
    price.unit_amount === entry.unitAmount &&
    price.currency === "usd" &&
    Boolean(price.recurring) === entry.recurring &&
    (!entry.recurring || price.recurring?.interval === "month") &&
    productName(price) === entry.productName
  );
}

async function sync() {
  const prices = await activePrices();

  for (const key of Object.keys(CATALOG) as CatalogKey[]) {
    const entry = CATALOG[key];

    const byKey = prices.find((p) => p.lookup_key === entry.lookupKey);
    if (byKey) {
      if (!matches(byKey, entry)) {
        throw new Error(
          `${entry.lookupKey} points at ${byKey.id}, which is ` +
            `${money(byKey.unit_amount, byKey.currency)} on ` +
            `"${productName(byKey)}", not ` +
            `${money(entry.unitAmount, "usd")} on "${entry.productName}". ` +
            "Fix it in the dashboard; this script will not repoint a key.",
        );
      }
      console.log(`ok       ${entry.lookupKey}  ${byKey.id}`);
      continue;
    }

    // No key yet. Adopt a price that already looks right rather than making a
    // duplicate: these were created by hand before the keys existed.
    const candidate = prices.find((p) => !p.lookup_key && matches(p, entry));
    if (candidate) {
      await stripe().prices.update(candidate.id, {
        lookup_key: entry.lookupKey,
        transfer_lookup_key: true,
      });
      console.log(`keyed    ${entry.lookupKey}  ${candidate.id}`);
      continue;
    }

    const product = await stripe().products.create({ name: entry.productName });
    const price = await stripe().prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: entry.unitAmount,
      lookup_key: entry.lookupKey,
      transfer_lookup_key: true,
      ...(entry.recurring ? { recurring: { interval: "month" as const } } : {}),
    });
    console.log(`created  ${entry.lookupKey}  ${price.id}`);
  }
}

async function show() {
  const prices = await activePrices();
  if (prices.length === 0) {
    console.log("No prices. Run with --sync.");
    return;
  }

  console.log("lookup key        amount             product / price");
  for (const price of prices) {
    const cadence = price.recurring ? `/${price.recurring.interval}` : " once";
    console.log(
      [
        (price.lookup_key ?? "(none)").padEnd(17),
        `${money(price.unit_amount, price.currency)}${cadence}`.padEnd(18),
        `${productName(price)}  ${price.id}`,
      ].join(" "),
    );
  }
}

async function main() {
  console.log(`mode          ${mode()}`);
  console.log("");
  if (process.argv.includes("--sync")) {
    await sync();
    console.log("");
  }
  await show();
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

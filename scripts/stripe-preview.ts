// Opens a Checkout page as if you were somewhere else, so you can see what
// Adaptive Pricing actually charges.
//
// There is no control on the checkout page for this and no API field that
// reports it. Stripe decides the presentment currency from the customer's
// location and only ever shows the result to the customer. The one lever is
// a location-formatted email: a `+location_XX` suffix on customer_email
// makes the session render as if the buyer were in country XX.
//
// If you are in the United States you will never see a conversion on your
// own, because dollars are already your currency and ours. That is not a
// bug and not a misconfiguration.
//
//   npm run stripe:preview              the four countries we quote
//   npm run stripe:preview -- DE FR IN  any countries you like
//   npm run stripe:preview -- DE plus   a different offer
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { priceIdFor, type CatalogKey } from "@/lib/billing/catalog";
import { QUOTED, quotedForCountry } from "@/lib/billing/currencies";
import { estimateLocal } from "@/lib/billing/fx";
import { formatLocal } from "@/lib/billing/locale";
import { stripe } from "@/lib/billing/stripe";

const OFFERS: Record<string, { key: CatalogKey; cents: number; mode: "subscription" | "payment" }> = {
  plus: { key: "plus", cents: 2900, mode: "subscription" },
  pro: { key: "pro", cents: 9900, mode: "subscription" },
  pass: { key: "pass", cents: 15000, mode: "payment" },
};

/** What our own pricing page would print for this country, if anything. */
async function ourEstimate(country: string, cents: number) {
  const currency = quotedForCountry(country);
  if (!currency) return null;
  const [row] = await db
    .select()
    .from(fxRates)
    .where(eq(fxRates.currency, currency.code))
    .limit(1);
  if (!row) return null;
  return formatLocal(estimateLocal(cents, Number(row.baseRate)), currency);
}

async function main() {
  const args = process.argv.slice(2);
  const offerName = args.find((a) => a.toLowerCase() in OFFERS)?.toLowerCase() ?? "pro";
  const offer = OFFERS[offerName];

  const countries = args
    .filter((a) => /^[A-Za-z]{2}$/.test(a))
    .map((a) => a.toUpperCase());
  const targets = countries.length > 0 ? countries : QUOTED.map((c) => c.country);

  console.log(`  ${offerName} at $${(offer.cents / 100).toFixed(2)}, seen from ${targets.length} places.`);
  console.log("  Open a link and read the headline. The rate Stripe used is printed under it.");
  console.log("");

  for (const country of targets) {
    const session = await stripe().checkout.sessions.create({
      mode: offer.mode,
      line_items: [{ price: await priceIdFor(offer.key), quantity: 1 }],
      customer_email: `preview+location_${country}@example.test`,
      success_url: "https://example.com/unused",
      ...(offer.mode === "payment" ? { payment_intent_data: { setup_future_usage: "off_session" as const } } : {}),
    });

    const ours = await ourEstimate(country, offer.cents);
    console.log(`  ${country}${ours ? `  we show ${ours}` : "  (we do not quote this country)"}`);
    console.log(`    ${session.url}`);
    console.log("");
  }

  console.log("  These expire on their own. Nothing is charged unless you enter a card.");
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

// Checks the rate refresh, and is honest about the one thing it cannot check.
//
// Machine-checkable: that Stripe quotes every currency we list, that the
// mirror gets written, and that each rate agrees with the European Central
// Bank's published rate, which Stripe hands back alongside its own. That
// last one is the only independent second opinion available and it catches a
// rate that has gone obviously wrong.
//
// Not machine-checkable: ADAPTIVE_MARKUP, the 4% Adaptive Pricing adds at
// checkout. There is no API path to it. `presentment_details` is empty until
// a payment completes, and `currency_conversion` is present on the Checkout
// Session and null. So this script prints what we would show and the URL of
// a real session for each country, and someone has to open them and compare.
// That manual step is the finding, not an oversight.
//
//   npm run stripe:fx-check
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { priceIdFor } from "@/lib/billing/catalog";
import { QUOTED } from "@/lib/billing/currencies";
import { ADAPTIVE_MARKUP, estimateLocal, fetchQuotes, refreshRates } from "@/lib/billing/fx";
import { stripe } from "@/lib/billing/stripe";

// Pro, because it is the largest recurring price and so the least forgiving.
const USD_CENTS = 9900;
// Stripe's mid-market rate and the ECB's will never match exactly. They are
// sourced differently and published on different schedules. More than two
// percent apart means one of them is wrong.
const ECB_TOLERANCE = 0.02;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

/** A live session for a customer in `country`, for a human to open. */
async function sessionFor(country: string) {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: await priceIdFor("pro"), quantity: 1 }],
    customer_email: `fxcheck+location_${country}@example.test`,
    success_url: "https://example.com/unused",
  });
  return session;
}

async function main() {
  const quotes = await fetchQuotes();
  check(`Stripe quoted all ${QUOTED.length} currencies`, quotes.length === QUOTED.length);

  for (const quote of quotes) {
    if (quote.referenceRate === null) {
      // Not a failure. Stripe only carries ECB rates for the currencies the
      // ECB publishes, and BRL and KRW are not always among them.
      console.log(`      ${quote.currency}: no ECB rate to compare against`);
      continue;
    }
    const drift = quote.baseRate / quote.referenceRate - 1;
    check(
      `${quote.currency}: Stripe's rate is within ` +
        `${(ECB_TOLERANCE * 100).toFixed(0)}% of the ECB's ` +
        `(${(drift * 100).toFixed(2)}%)`,
      Math.abs(drift) <= ECB_TOLERANCE,
    );
  }

  const written = await refreshRates();
  check(`the mirror took all ${written.length} rates`, written.length === quotes.length);

  console.log("");
  console.log("  What the pricing page will show for $99 Pro, and where to check it.");
  console.log("  Stripe will not report the presentment amount before payment, so");
  console.log("  the last comparison is by eye. Open each and read the headline.");
  console.log("");

  for (const currency of QUOTED) {
    const [row] = await db
      .select()
      .from(fxRates)
      .where(eq(fxRates.currency, currency.code))
      .limit(1);
    if (!row) {
      check(`${currency.code} is in the mirror`, false);
      continue;
    }
    check(`${currency.code}: stored rate is a positive number`, Number(row.baseRate) > 0);

    const ours = estimateLocal(USD_CENTS, Number(row.baseRate));
    const formatted = new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code.toUpperCase(),
    }).format(ours);
    const session = await sessionFor(currency.country);

    console.log(`  ${currency.label} (${currency.code}) — we show ${formatted}`);
    console.log(`    ${session.url}`);
  }

  console.log("");
  console.log(
    `  If a headline differs from the figure above by more than rounding, ` +
      `ADAPTIVE_MARKUP (${ADAPTIVE_MARKUP}) has moved and src/lib/billing/fx.ts needs it.`,
  );
  console.log("  The sessions above expire on their own; nothing was charged.");
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

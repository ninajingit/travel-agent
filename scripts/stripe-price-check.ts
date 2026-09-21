// Checks that what the site quotes is what Stripe will charge.
//
// This is the failure the price mirror exists to stop, and it is a quiet
// one. Nothing throws when a price on the site disagrees with Stripe. The
// page simply advertises a number we will not take, and the first person to
// notice is a customer at a checkout page showing something else.
//
// Three things are compared: Stripe against the mirror, the mirror against
// the fallback amounts in CATALOG, and the mirror against what a Checkout
// Session actually charges.
//
//   npm run stripe:price-check
import { CATALOG, priceIdFor, type CatalogKey } from "@/lib/billing/catalog";
import { membershipCheckout } from "@/lib/billing/checkout";
import { fetchCatalogPrices, formatPrice, getPrices, refreshCatalogPrices } from "@/lib/billing/prices";
import { stripe } from "@/lib/billing/stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const tag = Math.random().toString(36).slice(2, 10);

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const live = await fetchCatalogPrices();
  check(`Stripe returned all ${Object.keys(CATALOG).length} prices`, live.length === 3);

  await refreshCatalogPrices();
  const mirrored = await getPrices();

  for (const [key, entry] of Object.entries(CATALOG) as [CatalogKey, (typeof CATALOG)[CatalogKey]][]) {
    const fromStripe = live.find((p) => p.lookupKey === entry.lookupKey);
    const fromMirror = mirrored[key];
    if (!fromStripe) {
      check(`${key}: Stripe has a price for ${entry.lookupKey}`, false);
      continue;
    }

    check(
      `${key}: the mirror matches Stripe (${formatPrice(fromMirror)})`,
      fromMirror.unitAmount === fromStripe.unitAmount &&
        fromMirror.stripePriceId === fromStripe.stripePriceId,
    );

    // The fallback is what a page shows before the mirror has ever been
    // filled. It drifting is not an outage, but it is the old bug coming
    // back, so it fails here rather than waiting to be noticed.
    check(
      `${key}: the fallback in catalog.ts still agrees (${entry.unitAmount})`,
      entry.unitAmount === fromStripe.unitAmount,
    );
  }

  // The end of the chain. A mirror that agrees with the Prices API but not
  // with Checkout would still be a site quoting the wrong number.
  const [user] = await db
    .insert(users)
    .values({ clerkId: `price_${tag}`, email: `price_${tag}@example.test`, name: "Price" })
    .returning();
  try {
    for (const key of ["plus", "pro"] as const) {
      const session = await membershipCheckout(user, key);
      const opened = await stripe().checkout.sessions.retrieve(session.id);
      // Pro is offered with a trial, which bills nothing today, so the line
      // item is the honest comparison rather than amount_total.
      const lineItems = await stripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
      const charged = lineItems.data[0]?.price?.unit_amount ?? null;
      check(
        `${key}: Checkout charges what the site says (${formatPrice(mirrored[key])})`,
        charged === mirrored[key].unitAmount,
      );
      await stripe().checkout.sessions.expire(opened.id);
    }

    check(
      `pass: the price id we check out with is the one in the mirror`,
      (await priceIdFor("pass")) === mirrored.pass.stripePriceId,
    );
  } finally {
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (row?.stripeCustomerId) await stripe().customers.del(row.stripeCustomerId);
    await db.delete(users).where(eq(users.id, user.id));
    console.log("cleaned up");
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

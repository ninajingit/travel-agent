// Builds real Checkout Sessions in the sandbox and asserts their shape, then
// expires them so nothing is left half-open.
//
//   npm run stripe:checkout-check
//
// Completing a session needs a browser and a test card; that part is done by
// hand. This covers everything up to the redirect.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, users } from "@/db/schema";
import { LOOKUP_KEYS } from "@/lib/billing/catalog";
import { membershipCheckout, passCheckout } from "@/lib/billing/checkout";
import { stripe } from "@/lib/billing/stripe";
import { blockingSubscription } from "@/lib/billing/subscription";
import { METADATA } from "@/lib/billing/webhook";

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error("No users in this database. Sign in once first.");
  console.log(`user          ${user.id}  ${user.email}`);

  const blocking = await blockingSubscription(user.id);
  check("no live subscription, so a checkout is allowed", blocking === null);

  // Membership
  const plus = await membershipCheckout(user, "plus");
  try {
    check("membership session is subscription mode", plus.mode === "subscription");
    check("session has a redirect url", Boolean(plus.url));
    check("session carries the user id", plus.metadata?.[METADATA.userId] === String(user.id));
    check("customer attached", Boolean(plus.customer));

    const full = await stripe().checkout.sessions.retrieve(plus.id, {
      expand: ["line_items.data.price", "subscription_data"],
    });
    const price = full.line_items?.data[0]?.price;
    check("priced from the plus lookup key", price?.lookup_key === LOOKUP_KEYS.plus);
    check("amount is 29.00 USD", price?.unit_amount === 2900 && price?.currency === "usd");
    check("returns to our own domain", Boolean(plus.success_url?.startsWith("http")));

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    check("customer id stored on the person", after?.stripeCustomerId === plus.customer);

    console.log(`\nplus checkout  ${plus.url}\n`);
  } finally {
    await stripe().checkout.sessions.expire(plus.id);
  }

  // Concierge Pass, if this account has a trip to buy one for.
  const [trip] = await db.select().from(trips).where(eq(trips.userId, user.id)).limit(1);
  if (!trip) {
    console.log("no trips for this user, skipping the pass checks");
    return;
  }
  const pass = await passCheckout(user, trip.id);
  try {
    check("pass session is payment mode", pass.mode === "payment");
    check("pass carries the trip id", pass.metadata?.[METADATA.tripId] === String(trip.id));
    check("pass carries the user id", pass.metadata?.[METADATA.userId] === String(user.id));

    const full = await stripe().checkout.sessions.retrieve(pass.id, {
      expand: ["line_items.data.price"],
    });
    const price = full.line_items?.data[0]?.price;
    check("priced from the pass lookup key", price?.lookup_key === LOOKUP_KEYS.pass);
    check("amount is 150.00 USD once", price?.unit_amount === 15000 && !price?.recurring);

    console.log(`\npass checkout  ${pass.url}\n`);
  } finally {
    await stripe().checkout.sessions.expire(pass.id);
  }
  console.log("sessions expired");
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

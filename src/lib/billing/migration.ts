import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { stripe } from "./stripe";

// Same shape the rest of src/lib/billing uses.
type User = typeof users.$inferSelect;

/**
 * Moving the legacy $20-per-booking payers onto a membership.
 *
 * They paid through Payment Links Priya made by hand. Those payments left us
 * nothing to work with: the link has `customer_creation: "if_required"` and
 * no `setup_future_usage`, so there is no saved card and no agreement to
 * bill anyone again. Nobody can be migrated in the background. Each of them
 * has to choose a plan and enter a card, and all we can do is make that as
 * short as possible.
 *
 * The obvious route is closed in both directions. A Checkout Session can be
 * bound to their existing customer but expires in under 24 hours, so it
 * cannot go in an email. A Payment Link lasts forever but rejects a
 * `customer` outright, so it would make a second customer for someone we
 * already have and split their history down the middle.
 *
 * Hence this: our own URL, which never expires, carrying a signed token. The
 * Stripe session is created when they click.
 */

/** Ties a link to one Stripe customer without a table to look it up in. */
function secret() {
  const value = process.env.MIGRATION_SECRET;
  if (!value) {
    throw new Error(
      "MIGRATION_SECRET is not set. The switch links are signed with it.",
    );
  }
  return value;
}

function sign(customerId: string) {
  return createHmac("sha256", secret()).update(customerId).digest("base64url");
}

export function signSwitchToken(customerId: string) {
  return `${customerId}.${sign(customerId)}`;
}

/**
 * The customer a token names, or null.
 *
 * Signed rather than opaque because an unsigned token would let anyone name
 * any customer and attach a subscription to a stranger's record.
 */
export function verifySwitchToken(token: string | null | undefined) {
  if (!token) return null;
  const cut = token.lastIndexOf(".");
  if (cut < 1) return null;

  const customerId = token.slice(0, cut);
  const provided = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(sign(customerId));
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  return customerId;
}

/**
 * Everyone who paid through a given Payment Link.
 *
 * The one part of this that Stripe makes easy. Sessions can be filtered by
 * the link that made them, and each carries the customer and the email, so
 * the cohort is a query rather than a spreadsheet.
 */
export async function payersOf(paymentLinkId: string) {
  const found = new Map<string, { customerId: string; email: string | null }>();

  for await (const session of stripe().checkout.sessions.list({
    payment_link: paymentLinkId,
    limit: 100,
  })) {
    if (session.payment_status !== "paid") continue;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!customerId) continue;
    // One row per person, however many times they bought.
    if (!found.has(customerId)) {
      found.set(customerId, {
        customerId,
        email: session.customer_details?.email ?? null,
      });
    }
  }

  return [...found.values()];
}

export type LinkResult =
  | { ok: true; customerId: string; alreadyLinked: boolean }
  | { ok: false; reason: "taken" };

/**
 * Point this person at the Stripe customer that holds their old payments.
 *
 * Everything downstream then works untouched: getOrCreateCustomer returns
 * this id, Checkout puts the subscription on it, and their $20 payments and
 * their membership end up on one record instead of two.
 *
 * `users.stripe_customer_id` is unique, so a customer already claimed by
 * someone else is refused rather than moved. Two people sharing one Stripe
 * customer would make entitlement answer for the wrong person.
 */
export async function linkLegacyCustomer(
  user: User,
  customerId: string,
): Promise<LinkResult> {
  if (user.stripeCustomerId === customerId) {
    return { ok: true, customerId, alreadyLinked: true };
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (owner && owner.id !== user.id) return { ok: false, reason: "taken" };

  // Someone who already reached Stripe under their own customer keeps it.
  // Merging two customers is not something we can do from here, and quietly
  // repointing them would orphan whatever is on the first one.
  if (user.stripeCustomerId) {
    return { ok: true, customerId: user.stripeCustomerId, alreadyLinked: false };
  }

  await db
    .update(users)
    .set({ stripeCustomerId: customerId })
    .where(eq(users.id, user.id));

  return { ok: true, customerId, alreadyLinked: false };
}

// Makes the two shareable test accounts: one on Free, one on a paid Pro
// membership. For handing to someone outside the team who needs to walk the
// product on both sides of the paywall without going through Checkout.
//
//   npm run test:accounts
//
// Passwords are generated here and printed once. They are not stored
// anywhere by this script; Clerk holds the hash. Running it again resets
// both passwords and prints new ones. Safe to repeat: every write is keyed
// on something stable.
//
// The addresses carry Clerk's `+clerk_test` marker. On a development
// instance Clerk sends no email to those and accepts 424242 as every code,
// which matters because Clerk asks for an emailed code on the first sign-in
// from a new device, and the people these logins are for have no inbox to
// read it from.
//
// The Pro account is put on Pro the way Stripe would leave it, not by
// writing the mirror table: a customer, a test card, and a real subscription
// in the sandbox, which the webhook and this script both write into the
// mirror with the same upsert. The one thing this shortcut skips is the
// consent text on the Checkout page, so booking consent is recorded here
// with a note in the Stripe customer's metadata saying so.
import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { priceIdFor } from "@/lib/billing/catalog";
import { getOrCreateCustomer } from "@/lib/billing/checkout";
import { getEntitlement } from "@/lib/billing/entitlement";
import { stripe } from "@/lib/billing/stripe";
import { METADATA, upsertSubscription } from "@/lib/billing/webhook";
import { seedDemoData } from "@/lib/demo";

// The first version of this script used plus-addresses on a real mailbox.
// Accounts made that way are moved onto the test address, keeping their
// Clerk id, their users row, and (for Pro) their Stripe customer.
const LEGACY_OWNER = "nina.hyein.jin@gmail.com";

const ACCOUNTS = [
  { tag: "mira-free", firstName: "Free", lastName: "Tester", plan: "free" as const },
  { tag: "mira-pro", firstName: "Pro", lastName: "Tester", plan: "pro" as const },
];

function emailFor(tag: string) {
  return `${tag}+clerk_test@example.com`;
}

function legacyEmailFor(tag: string) {
  const [local, domain] = LEGACY_OWNER.split("@");
  return `${local}+${tag}@${domain}`;
}

// 16 characters from a URL-safe alphabet: long enough for Clerk's checks,
// short enough to type from a message.
function newPassword() {
  return randomBytes(12).toString("base64url");
}

async function ensureClerkUser(
  email: string,
  legacyEmail: string,
  firstName: string,
  lastName: string,
  password: string,
) {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({
    emailAddress: [email, legacyEmail],
  });
  const existing = data[0];
  if (existing) {
    await clerk.users.updateUser(existing.id, { password, firstName, lastName });

    // Move a legacy account onto the test address: add the new one as the
    // verified primary, then drop the old one.
    const onNewAddress = existing.emailAddresses.some(
      (e) => e.emailAddress === email,
    );
    if (!onNewAddress) {
      await clerk.emailAddresses.createEmailAddress({
        userId: existing.id,
        emailAddress: email,
        verified: true,
        primary: true,
      });
      for (const old of existing.emailAddresses) {
        if (old.emailAddress === legacyEmail) {
          await clerk.emailAddresses.deleteEmailAddress(old.id);
        }
      }
    }
    return { id: existing.id, created: false };
  }
  const created = await clerk.users.createUser({
    emailAddress: [email],
    password,
    firstName,
    lastName,
  });
  return { id: created.id, created: true };
}

async function ensureUserRow(clerkId: string, email: string, name: string) {
  const [row] = await db
    .insert(users)
    .values({ clerkId, email, name })
    .onConflictDoUpdate({ target: users.clerkId, set: { email, name } })
    .returning();
  return row;
}

// The demo's bookings are dated the first week of September 2026 (see
// TRANSACTIONS in src/lib/demo). A membership that started today would have
// a billing period that begins after them, and the Activity page would open
// on "0 of 50". Stripe lets a subscription start in the past, so the Pro
// account's period is made to begin here and contain them.
const DEMO_PERIOD_START = new Date("2026-09-01T00:00:00Z");

/** A paid Pro subscription on a test card whose period holds the demo. */
async function ensurePro(user: typeof users.$inferSelect) {
  const customerId = await getOrCreateCustomer(user);

  const live = await stripe().subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  const current = live.data[0];
  if (current) {
    const periodStart = current.items.data[0]?.current_period_start ?? 0;
    if (periodStart * 1000 <= DEMO_PERIOD_START.getTime()) {
      await upsertSubscription(current);
      return { subscriptionId: current.id, created: false };
    }
    // Started too late to show the demo; replace it with a backdated one.
    const cancelled = await stripe().subscriptions.cancel(current.id);
    await upsertSubscription(cancelled);
  }

  // Stripe's test card, attached and made the default so the subscription
  // and any later booking charge both find it. Once is enough.
  const customer = await stripe().customers.retrieve(customerId);
  const hasDefault =
    !customer.deleted && Boolean(customer.invoice_settings?.default_payment_method);
  if (!hasDefault) {
    const card = await stripe().paymentMethods.attach("pm_card_visa", {
      customer: customerId,
    });
    await stripe().customers.update(customerId, {
      invoice_settings: { default_payment_method: card.id },
      metadata: {
        test_account: "true",
        booking_consent: "recorded by scripts/test-accounts.ts, not by Checkout",
      },
    });
  }

  // No trial: this account should look like a member who is paying, so the
  // Stripe side shows an invoice and a charge, not a $0 trial.
  const subscription = await stripe().subscriptions.create({
    customer: customerId,
    items: [{ price: await priceIdFor("pro") }],
    metadata: { [METADATA.userId]: String(user.id) },
    payment_behavior: "error_if_incomplete",
    backdate_start_date: Math.floor(DEMO_PERIOD_START.getTime() / 1000),
  });
  await upsertSubscription(subscription);
  return { subscriptionId: subscription.id, created: true };
}

async function main() {
  const logins: Array<{ plan: string; email: string; password: string }> = [];

  for (const account of ACCOUNTS) {
    const email = emailFor(account.tag);
    const password = newPassword();
    const name = `${account.firstName} ${account.lastName}`;

    const clerkUser = await ensureClerkUser(
      email,
      legacyEmailFor(account.tag),
      account.firstName,
      account.lastName,
      password,
    );
    const user = await ensureUserRow(clerkUser.id, email, name);
    console.log(
      `${account.plan.padEnd(5)} ${email}  clerk ${clerkUser.id} (${clerkUser.created ? "new" : "existing"})  user ${user.id}`,
    );

    await seedDemoData(user.id, account.plan === "free" ? "free" : "booking");

    if (account.plan === "pro") {
      const pro = await ensurePro(user);
      console.log(`      subscription ${pro.subscriptionId} (${pro.created ? "new" : "existing"})`);

      // Checkout would have recorded this when the consent text was accepted.
      // There was no Checkout, so it is recorded here; see the header.
      if (!user.bookingConsentAt) {
        await db
          .update(users)
          .set({ bookingConsentAt: new Date() })
          .where(eq(users.id, user.id));
      }
    }

    const entitlement = await getEntitlement(user.id);
    console.log(
      `      entitlement: ${entitlement.plan}, ${entitlement.actionsAllowed} actions allowed, status ${entitlement.status ?? "none"}`,
    );
    if (entitlement.plan !== account.plan) {
      throw new Error(`${email} should be on ${account.plan} but entitlement says ${entitlement.plan}`);
    }

    logins.push({ plan: account.plan, email, password });
  }

  console.log("");
  console.log("Logins (printed once, not stored):");
  for (const login of logins) {
    console.log(`  ${login.plan.padEnd(5)} ${login.email}  ${login.password}`);
  }
  console.log("  If Clerk asks for an emailed code, it is 424242.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

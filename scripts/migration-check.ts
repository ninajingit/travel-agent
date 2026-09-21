// Checks the legacy-payer switch: the signed links, and the rule that
// decides which Stripe customer a person ends up on.
//
// The binding is the part worth testing. Get it wrong in one direction and
// someone's old payments stay orphaned on a customer nobody owns. Get it
// wrong in the other and two people share one Stripe customer, which makes
// getEntitlement answer for the wrong person.
//
// Creates throwaway users and removes them.
//
//   npm run stripe:migration-check
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  linkLegacyCustomer,
  signSwitchToken,
  verifySwitchToken,
} from "@/lib/billing/migration";

const tag = Math.random().toString(36).slice(2, 10);
const LEGACY = `cus_legacy_${tag}`;
const OWN = `cus_own_${tag}`;
// A second, unclaimed legacy customer, so the "keeps their own" case is not
// confused with the "already taken by someone else" case.
const SPARE = `cus_spare_${tag}`;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function makeUser(suffix: string, stripeCustomerId: string | null = null) {
  const [row] = await db
    .insert(users)
    .values({
      clerkId: `switch_${tag}_${suffix}`,
      email: `switch_${tag}_${suffix}@example.test`,
      name: "Switch",
      stripeCustomerId,
    })
    .returning();
  return row;
}

async function main() {
  const clerkIds = [`switch_${tag}_a`, `switch_${tag}_b`, `switch_${tag}_c`];
  try {
    // --- the signed links ---
    const token = signSwitchToken(LEGACY);
    check("a token round-trips to its customer", verifySwitchToken(token) === LEGACY);
    check("a changed signature is refused", verifySwitchToken(`${LEGACY}.nope`) === null);
    check(
      "a changed customer is refused",
      verifySwitchToken(`cus_someoneelse.${token.split(".").pop()}`) === null,
    );
    // An unsigned id is the attack that matters: without a signature anyone
    // could put a stranger's customer in the URL and subscribe against it.
    check("a bare customer id is refused", verifySwitchToken(LEGACY) === null);
    check("junk is refused", verifySwitchToken("garbage") === null);
    check("nothing is refused", verifySwitchToken(null) === null);

    // --- who ends up on which customer ---
    const first = await makeUser("a");
    const linked = await linkLegacyCustomer(first, LEGACY);
    check("a new person takes the legacy customer", linked.ok && linked.customerId === LEGACY);

    const [reread] = await db.select().from(users).where(eq(users.id, first.id)).limit(1);
    check("and it is written down", reread.stripeCustomerId === LEGACY);

    const again = await linkLegacyCustomer(reread, LEGACY);
    check("following the link twice is a no-op", again.ok && again.alreadyLinked);

    // The same email arriving twice, or a forwarded link. The second person
    // must not be put on the first person's customer.
    const second = await makeUser("b");
    const stolen = await linkLegacyCustomer(second, LEGACY);
    check("a second person cannot take the same customer", !stolen.ok);

    const [secondReread] = await db.select().from(users).where(eq(users.id, second.id)).limit(1);
    check("and nothing was written for them", secondReread.stripeCustomerId === null);

    // Someone who already paid us under their own customer. Repointing them
    // would orphan whatever is on the first one. SPARE is unclaimed, so this
    // tests the rule and not the collision above.
    const existing = await makeUser("c", OWN);
    const kept = await linkLegacyCustomer(existing, SPARE);
    check("someone with their own customer keeps it", kept.ok && kept.customerId === OWN);

    const [existingReread] = await db.select().from(users).where(eq(users.id, existing.id)).limit(1);
    check("and it was not overwritten", existingReread.stripeCustomerId === OWN);

    // Both at once: they have their own customer and the legacy one belongs
    // to somebody else. Refusing is right, because the page then tells them
    // their history is on another account instead of silently ignoring it.
    const clash = await linkLegacyCustomer(existingReread, LEGACY);
    check("own customer plus a taken legacy customer is refused", !clash.ok);
  } finally {
    await db.delete(users).where(inArray(users.clerkId, clerkIds));
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

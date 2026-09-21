// Builds the switch links for everyone still on the legacy $20 payment link.
//
// Prints one row per person: their email, their Stripe customer, and a URL
// that never expires. Paste the URLs into the mail merge.
//
//   npm run stripe:migration-links -- plink_xxx
//
// Nothing is sent from here and nothing is changed in Stripe. This only
// reads and signs.
import { appBaseUrl } from "@/lib/billing/checkout";
import { payersOf, signSwitchToken, verifySwitchToken } from "@/lib/billing/migration";

async function main() {
  const paymentLinkId = process.argv.slice(2).find((a) => a.startsWith("plink_"));
  if (!paymentLinkId) {
    console.error("Give me the payment link id, e.g. npm run stripe:migration-links -- plink_123");
    process.exit(1);
  }

  const payers = await payersOf(paymentLinkId);
  if (payers.length === 0) {
    console.log(`  No paid sessions found against ${paymentLinkId}.`);
    return;
  }

  console.log(`  ${payers.length} people paid through ${paymentLinkId}.`);
  console.log("");

  for (const payer of payers) {
    const token = signSwitchToken(payer.customerId);
    // A signature that does not verify would send someone to an error page
    // from an email we cannot recall, so check before printing.
    if (verifySwitchToken(token) !== payer.customerId) {
      console.log(`  SKIPPED ${payer.customerId}: token did not verify`);
      process.exitCode = 1;
      continue;
    }
    console.log(`  ${payer.email ?? "(no email on file)"}  ${payer.customerId}`);
    console.log(`    ${appBaseUrl()}/switch?t=${encodeURIComponent(token)}`);
    console.log("");
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

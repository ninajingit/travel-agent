import Stripe from "stripe";

// Pinned on purpose. Stripe moved the subscription billing period onto the
// subscription's items in 2025-03-31.basil, and the webhook endpoint is
// registered with this same version, so payloads and reads agree. Changing
// this line means re-reading the changelog, not just bumping a number.
export const STRIPE_API_VERSION = "2026-08-26.dahlia";

let client: Stripe | null = null;

/**
 * The Stripe client, built on first use.
 *
 * Deliberately not a module-level constant. Next evaluates every route module
 * at build time to collect its configuration, so a client that threw on a
 * missing key turned one unset variable into a failed deploy of the whole
 * site, marketing pages included. A billing key should only be able to break
 * billing. Missing it now fails the request that needed Stripe, with the same
 * message, and leaves everything else standing.
 *
 * Server only. Nothing under src/app imports `stripe` directly; it comes from
 * here so the key and the API version have one home.
 */
export function stripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Copy it from the Stripe dashboard into " +
        ".env.local, and into the Vercel project before deploying.",
    );
  }

  client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Mira", url: "https://travel-agent-two-delta.vercel.app" },
  });
  return client;
}

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Copy it from the Stripe dashboard into " +
      ".env.local, and into the Vercel project before deploying.",
  );
}

// Pinned on purpose. Stripe moved the subscription billing period onto the
// subscription's items in 2025-03-31.basil, and the webhook endpoint is
// registered with this same version, so payloads and reads agree. Changing
// this line means re-reading the changelog, not just bumping a number.
export const STRIPE_API_VERSION = "2026-08-26.dahlia";

// Server only. Nothing under src/app may import `stripe` directly; it comes
// from here so the key and the API version have one home.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
  appInfo: { name: "Mira", url: "https://travel-agent-two-delta.vercel.app" },
});

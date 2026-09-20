import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api";
import { signedInUser } from "@/lib/auth";
import { portalSession } from "@/lib/billing/checkout";

// Opens the Stripe Customer Portal. Changing plan, updating the card,
// cancelling, and reading invoices all happen there; we link, we do not
// rebuild it.
export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  // Nothing to manage until this person has reached Stripe at least once.
  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "You do not have a membership to manage yet." },
      { status: 409 },
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo");
  // Only our own paths, so the return_url cannot be pointed elsewhere.
  const returnPath = returnTo?.startsWith("/") ? returnTo : "/app/membership";

  const session = await portalSession(user, returnPath);
  return NextResponse.json({ url: session.url });
}

import { NextResponse } from "next/server";
import { badRequest, notFound, readJsonObject, unauthorized } from "@/lib/api";
import { signedInUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing/entitlement";
import { stripe } from "@/lib/billing/stripe";
import { METADATA, syncCheckoutSession } from "@/lib/billing/webhook";

/**
 * Confirms a Checkout Session the person has just come back from.
 *
 * Stripe redirects the browser home the instant the payment clears, which is
 * often before the webhook has landed. Rather than show someone who has just
 * paid a page that says Free, this reads the session and applies it directly.
 * The webhook still arrives and does the same work; both paths end up at the
 * same row, so whichever wins does not matter.
 *
 * Lives in a route handler, not a page, so no page render waits on Stripe.
 */
export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  const sessionId = body?.sessionId;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return badRequest("sessionId is required.");
  }

  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return notFound();
  }

  // A session id is guessable-adjacent and arrives in a URL, so check it is
  // this person's before acting on it.
  if (session.metadata?.[METADATA.userId] !== String(user.id)) {
    return notFound();
  }

  if (session.status !== "complete") {
    return NextResponse.json({ ready: false, reason: "incomplete" });
  }

  await syncCheckoutSession(session);

  const entitlement = await getEntitlement(user.id);
  const ready =
    session.mode === "subscription"
      ? entitlement.plan !== "free"
      : entitlement.passes.length > 0;

  return NextResponse.json({ ready, plan: entitlement.plan });
}

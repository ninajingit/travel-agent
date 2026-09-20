import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conciergePasses } from "@/db/schema";
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

  if (session.mode === "subscription") {
    const entitlement = await getEntitlement(user.id);
    return NextResponse.json({ ready: entitlement.plan !== "free", plan: entitlement.plan });
  }

  // For a pass, ask whether this session granted one. "Does the account have
  // any pass" would answer yes to someone who already had one.
  const [pass] = await db
    .select({ id: conciergePasses.id })
    .from(conciergePasses)
    .where(eq(conciergePasses.stripeCheckoutSessionId, session.id))
    .limit(1);
  return NextResponse.json({ ready: Boolean(pass) });
}

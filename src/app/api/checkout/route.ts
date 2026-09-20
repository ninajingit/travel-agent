import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conciergePasses } from "@/db/schema";
import { getTrip } from "@/db/queries/trips";
import { badRequest, notFound, readJsonObject, unauthorized } from "@/lib/api";
import { signedInUser } from "@/lib/auth";
import {
  membershipCheckout,
  passCheckout,
  portalSession,
} from "@/lib/billing/checkout";
import { blockingSubscription } from "@/lib/billing/subscription";

const OFFERS = ["plus", "pro", "pass"] as const;
type Offer = (typeof OFFERS)[number];

function isOffer(value: unknown): value is Offer {
  return typeof value === "string" && OFFERS.includes(value as Offer);
}

// Starts a hosted Stripe Checkout session and hands back its URL. The caller
// sends the person there; nothing card-shaped is rendered by us.
export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  if (!body) return badRequest("Body must be a JSON object.");
  if (!isOffer(body.offer)) {
    return badRequest(`offer must be one of: ${OFFERS.join(", ")}.`);
  }

  if (body.offer === "pass") {
    if (typeof body.tripId !== "number" || !Number.isInteger(body.tripId)) {
      return badRequest("tripId is required to buy a Concierge Pass.");
    }
    // Scoped to the owner, so a pass cannot be bought for someone else's trip.
    const trip = await getTrip(user.id, body.tripId);
    if (!trip) return notFound();

    const [existing] = await db
      .select({ id: conciergePasses.id })
      .from(conciergePasses)
      .where(
        and(
          eq(conciergePasses.userId, user.id),
          eq(conciergePasses.tripId, trip.id),
        ),
      )
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: "This trip already has a Concierge Pass." },
        { status: 409 },
      );
    }

    const session = await passCheckout(user, trip.id);
    return NextResponse.json({ url: session.url });
  }

  // One subscription per person. Changing plan, fixing a card, and cancelling
  // all happen in the Customer Portal, so a second Checkout is refused rather
  // than quietly leaving two subscriptions on one customer.
  const existing = await blockingSubscription(user.id);
  if (existing) {
    const portal = await portalSession(user);
    return NextResponse.json(
      {
        error:
          existing.plan === body.offer
            ? `You are already on ${existing.plan === "pro" ? "Pro" : "Plus"}.`
            : "Change your plan in the billing portal.",
        portalUrl: portal.url,
      },
      { status: 409 },
    );
  }

  const session = await membershipCheckout(user, body.offer);
  return NextResponse.json({ url: session.url });
}

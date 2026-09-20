import { NextResponse } from "next/server";
import {
  claimEvent,
  handleEvent,
  markProcessed,
} from "@/lib/billing/webhook";
import { stripe } from "@/lib/billing/stripe";

// Node, not edge: the Stripe SDK needs it. Never cached, and the body must be
// read as raw text because the signature is over the exact bytes Stripe sent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration, not a bad request. 500 makes Stripe retry, so events
    // are not lost while the variable is missing.
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature." }, { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (error) {
    // Unsigned or tampered. 400 so Stripe stops rather than retrying forever.
    const message = error instanceof Error ? error.message : "Bad signature.";
    console.error(`Stripe webhook signature rejected: ${message}`);
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  const mine = await claimEvent(event);
  if (!mine) {
    // Already handled. Redelivery is a no-op.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    // processed_at stays null, so Stripe's retry is let through rather than
    // being mistaken for a duplicate.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Stripe webhook ${event.type} ${event.id} failed: ${message}`);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  await markProcessed(event.id);
  return NextResponse.json({ received: true });
}

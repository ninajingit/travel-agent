import { NextResponse } from "next/server";
import { refreshRates } from "@/lib/billing/fx";

// Rates are pulled here and written to the mirror, because the pricing page
// may not call Stripe. Vercel Cron calls this on a schedule; it is also safe
// to call by hand, since the write is an upsert and repeating it changes
// nothing but fetched_at.
//
// Not covered by src/proxy.ts, which leaves /api alone, so the shared secret
// below is the only thing standing in front of it. Without that anyone could
// make us spend Stripe calls.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this route refuses to run." },
      { status: 500 },
    );
  }
  // Vercel Cron sends the secret as a bearer token. A manual call can do the
  // same with curl.
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const written = await refreshRates();
    return NextResponse.json({
      refreshed: written.length,
      currencies: written.map((q) => q.currency),
      at: new Date().toISOString(),
    });
  } catch (error) {
    // Say what broke. A silent failure here means the pricing page keeps
    // showing yesterday's number and nobody finds out.
    // Drizzle wraps the driver's error, so the reason lives on `cause`.
    // Logging only `message` gives you "Failed query" and the SQL, which
    // tells you nothing about why it failed.
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
    console.error("fx refresh failed:", cause ?? message);
    return NextResponse.json({ error: cause ?? message }, { status: 502 });
  }
}

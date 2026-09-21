import { NextResponse } from "next/server";
import { refreshCatalogPrices } from "@/lib/billing/prices";

// A nightly safety net under the webhook. The webhook keeps prices current
// within seconds; this catches the case where one was missed or the endpoint
// was down, because a stale price is not an error anyone would notice.
//
// Same shared secret as the FX refresh, and the same refusal to run without
// it. The write is an upsert, so calling it twice costs a timestamp.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this route refuses to run." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const prices = await refreshCatalogPrices();
    return NextResponse.json({
      refreshed: prices.length,
      prices: prices.map((p) => `${p.lookupKey}=${p.unitAmount}`),
      at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
    console.error("catalog refresh failed:", cause ?? message);
    return NextResponse.json({ error: cause ?? message }, { status: 502 });
  }
}

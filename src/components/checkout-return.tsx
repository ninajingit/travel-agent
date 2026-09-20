"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

/**
 * Bridges the gap between paying and the app knowing about it.
 *
 * Stripe sends people back the moment the card clears, which can be before
 * the webhook lands. This confirms the session and refreshes once the
 * membership is really there, so nobody who has just paid sits looking at a
 * page that says Free.
 */
export function CheckoutReturn({
  sessionId,
  kind = "membership",
}: {
  sessionId: string;
  kind?: "membership" | "pass";
}) {
  const noun = kind === "pass" ? "Concierge Pass" : "membership";
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function confirm() {
      attempts += 1;
      try {
        const response = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const body = await response.json();
        if (cancelled) return;
        if (response.ok && body.ready) {
          router.refresh();
          return;
        }
      } catch {
        // Fall through to another attempt.
      }
      if (cancelled) return;
      if (attempts >= 5) {
        setSlow(true);
        return;
      }
      setTimeout(confirm, 1500);
    }

    confirm();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  return (
    <Card className="mt-8 border-accent p-5">
      <p className="font-semibold">Payment received.</p>
      <p className="mt-1 text-sm text-muted">
        {slow
          ? `Your ${noun} is taking longer than usual to appear. It is paid for and it will show up here shortly.`
          : `Setting up your ${noun}. This page updates on its own.`}
      </p>
    </Card>
  );
}

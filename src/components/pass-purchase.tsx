"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";

// Buys a Concierge Pass for one trip. Goes to hosted Checkout like every
// other purchase; nothing card-shaped is rendered here.
export function PassPurchase({ tripId }: { tripId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offer: "pass", tripId }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) {
        setError(body.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach checkout. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={buy} disabled={busy}>
        {busy ? "Opening…" : "Buy a Concierge Pass, $150"}
      </Button>
      {error && <ErrorText className="mt-2">{error}</ErrorText>}
    </div>
  );
}

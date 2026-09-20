"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText } from "@/components/ui";

/**
 * Cancels something Mira booked and gives the money back.
 *
 * Sits next to the charge rather than on a settings page, because the moment
 * someone wants their money back is the moment they are looking at what was
 * taken. Asks once, since a refund is not a thing to do by accident.
 */
export function CancelBooking({ transactionId }: { transactionId: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel(cancelledBy: "traveller" | "mira") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cancelledBy }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not cancel this.");
        return;
      }
      setAsking(false);
      router.refresh();
    } catch {
      setError("Could not reach Mira. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-sm text-muted underline hover:text-fg"
      >
        Cancel and refund
      </button>
    );
  }

  // Two buttons rather than one, because the answer changes what this costs.
  return (
    <div className="rounded-control border border-border bg-bg p-3">
      <p className="text-sm font-medium">Cancel this and refund it. Why?</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => cancel("traveller")}
          disabled={busy}
          className="px-3 py-1.5"
        >
          {busy ? "Refunding…" : "I changed my mind"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => cancel("mira")}
          disabled={busy}
          className="px-3 py-1.5"
        >
          {busy ? "Refunding…" : "Mira got this wrong"}
        </Button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="text-sm text-muted underline hover:text-fg"
        >
          Keep it
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Either way you get the money back. Changing your mind uses one of your
        actions; Mira putting its own mistake right does not.
      </p>
      {error && <ErrorText className="mt-2">{error}</ErrorText>}
    </div>
  );
}

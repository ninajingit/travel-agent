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

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/cancel`, {
        method: "POST",
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Cancel this and refund it?</span>
      <Button variant="secondary" onClick={cancel} disabled={busy} className="px-3 py-1.5">
        {busy ? "Refunding…" : "Yes, refund"}
      </Button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="text-sm text-muted underline hover:text-fg"
      >
        Keep it
      </button>
      {error && <ErrorText className="w-full">{error}</ErrorText>}
    </div>
  );
}

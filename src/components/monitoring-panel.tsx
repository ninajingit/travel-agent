"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorText } from "@/components/ui";

// The concierge's read on a trip: what is wrong, what it suggests, one button.
// Accepting posts to the rebook route and refreshes the page so the itinerary
// below picks up the new segment from the server.

type Props = {
  tripId: number;
  segmentId: number;
  carrier: string;
  delayMinutes: number;
  reason: string;
  autoRebook: boolean;
  autoRebookAllowed: boolean;
  replacement: {
    carrier: string;
    departLabel: string;
    arriveLabel: string;
    amountLabel: string;
    summary: string;
  } | null;
};

// Three states, not two: on and allowed, off, and on but not included. The
// third is the one worth saying out loud, because the switch looks set.
function autoRebookNote(wanted: boolean, allowed: boolean) {
  if (wanted && allowed) {
    return "Auto-rebook is on. Mira would do this without asking once the delay is confirmed.";
  }
  if (wanted) {
    return "Auto-rebook is on in your settings, but your plan does not include it, so Mira is waiting for you.";
  }
  return "Auto-rebook is off, so Mira waits for you.";
}

export function MonitoringPanel(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${props.tripId}/rebook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ segmentId: props.segmentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setConfirmUrl(typeof data.confirmUrl === "string" ? data.confirmUrl : null);
        throw new Error(data.error ?? `Request failed (${response.status}).`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rebook. Try again.");
      setBusy(false);
    }
  }

  const hours = Math.floor(props.delayMinutes / 60);
  const minutes = props.delayMinutes % 60;
  const delayLabel =
    props.delayMinutes === 0
      ? "Delay reported"
      : `Delayed ${hours ? `${hours}h` : ""}${minutes ? `${String(minutes).padStart(2, "0")}m` : ""}`;

  return (
    <Card className="border-warn/60 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-warn">
        Delay detected
      </div>
      <div className="mt-1 font-display text-xl font-bold">
        {props.carrier}: {delayLabel}
      </div>
      <p className="mt-1 text-sm text-muted">{props.reason}</p>

      {props.replacement ? (
        <div className="mt-5 rounded-control border border-border bg-bg p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Rebook suggested
          </div>
          <div className="mt-1 font-semibold">{props.replacement.carrier}</div>
          <div className="mt-0.5 text-sm text-muted">
            {props.replacement.departLabel} → {props.replacement.arriveLabel}
          </div>
          <p className="mt-2 text-sm">{props.replacement.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={accept} disabled={busy}>
              {busy ? "Rebooking" : `Accept, ${props.replacement.amountLabel}`}
            </Button>
            <span className="text-sm text-muted">
              {autoRebookNote(props.autoRebook, props.autoRebookAllowed)}
            </span>
          </div>
          {error && (
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
              {confirmUrl && (
                <a href={confirmUrl} className="text-sm underline hover:text-fg">
                  Confirm the payment with your bank
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          No better option yet. Mira checks every few minutes and will suggest one here.
        </p>
      )}
    </Card>
  );
}

// Scripted monitoring. In the real product the agent watches supplier feeds
// and prices replacements live; here, a delayed segment maps to a canned
// delay and a canned replacement so the flow can be walked end to end.

export type Replacement = {
  carrier: string;
  ref: string;
  departAt: Date;
  arriveAt: Date;
  amountCents: number;
  summary: string;
};

export type DelayReport = {
  delayMinutes: number;
  reason: string;
  replacement: Replacement | null;
};

const SCRIPT: Record<string, DelayReport> = {
  "ANA NH 10": {
    delayMinutes: 160,
    reason: "Inbound aircraft arrived late into Haneda.",
    replacement: {
      carrier: "JAL JL 10",
      ref: "Q8PLD2",
      departAt: new Date("2026-09-25T09:05:00Z"),
      arriveAt: new Date("2026-09-25T19:35:00Z"),
      amountCents: 18_000,
      summary:
        "Same day, lands 1h05 later than your original schedule instead of 2h40. Confirmed seat, not standby. $180 fare difference; ANA refunds the unused segment.",
    },
  },
};

export function reportFor(segment: { carrier: string; status: string }): DelayReport | null {
  if (segment.status !== "delayed") return null;
  return (
    SCRIPT[segment.carrier] ?? {
      delayMinutes: 0,
      reason: "The carrier has reported a delay without a new time yet.",
      replacement: null,
    }
  );
}

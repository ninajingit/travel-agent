"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HistoryEntry } from "@/app/api/billing/history/route";
import { Card, ErrorText, Pill } from "@/components/ui";

const LABEL = {
  membership: "Membership",
  pass: "Pass",
  booking: "Booked",
  rebooking: "Rebooked",
  cancellation: "Refunded",
} as const;

const TONE = {
  membership: "violet",
  pass: "violet",
  booking: "neutral",
  rebooking: "neutral",
  cancellation: "danger",
} as const;

// The distinction that matters most on this page. A membership is money
// Llama Inc. keeps; a flight is money that went to an airline and was never
// ours. They arrive on the same card statement looking identical.
const WHOSE = {
  mira: "to Mira",
  travel: "on your behalf",
} as const;

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One list of everything Stripe has taken, membership and bookings together.
 *
 * Loaded after the page because the invoice half lives in Stripe and no page
 * here waits on Stripe to draw itself.
 */
export function BillingHistory() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/history")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) setError(body.error);
        else setEntries(body.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your history.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorText className="mt-4">{error}</ErrorText>;

  if (entries === null) {
    return <p className="mt-4 text-sm text-muted">Loading your history…</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        Nothing yet. Membership charges and anything Mira pays for on your
        behalf will both show up here.
      </p>
    );
  }

  const total = (group: "mira" | "travel") =>
    entries
      .filter((entry) => entry.group === group)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
  const currency = entries[0]?.currency ?? "USD";

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-muted">What you paid Mira</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {money(total("mira"), currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Membership and Concierge Passes.</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">What Mira paid on your behalf</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {money(total("travel"), currency)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Flights, rooms and tickets, after refunds. Never our money.
          </p>
        </Card>
      </div>

      <Card className="mt-3 divide-y divide-border">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid gap-2 p-4 sm:grid-cols-[6rem_1fr_auto] sm:items-start sm:gap-4"
        >
          <div className="text-sm text-muted">{day(entry.at)}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={TONE[entry.kind]}>{LABEL[entry.kind]}</Pill>
              <span className="text-xs text-muted">{WHOSE[entry.group]}</span>
              {entry.tripId && (
                <Link
                  href={`/app/trips/${entry.tripId}`}
                  className="text-sm text-muted hover:text-fg"
                >
                  trip →
                </Link>
              )}
              {entry.href && (
                <a
                  href={entry.href}
                  className="text-sm text-muted underline hover:text-fg"
                >
                  receipt
                </a>
              )}
            </div>
            <div className="mt-1.5 text-sm">{entry.description}</div>
          </div>
          <div className="font-mono text-sm font-semibold sm:text-right">
            {money(entry.amountCents, entry.currency)}
          </div>
        </div>
      ))}
      </Card>
    </>
  );
}

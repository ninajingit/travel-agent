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
  pass: "accent",
  booking: "neutral",
  rebooking: "neutral",
  cancellation: "danger",
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

  return (
    <Card className="mt-4 divide-y divide-border">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid gap-2 p-4 sm:grid-cols-[6rem_1fr_auto] sm:items-start sm:gap-4"
        >
          <div className="text-sm text-muted">{day(entry.at)}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={TONE[entry.kind]}>{LABEL[entry.kind]}</Pill>
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
  );
}

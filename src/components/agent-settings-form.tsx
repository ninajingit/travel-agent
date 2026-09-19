"use client";

import { useState } from "react";
import { Button, Card, ErrorText } from "@/components/ui";

type Channel = "web" | "whatsapp" | "imessage";

type Settings = {
  autoRebook: boolean;
  perBookingCapCents: number;
  monthlyCapCents: number;
  allowedChannels: Channel[];
};

const CHANNELS: Array<{ value: Channel; label: string; note: string }> = [
  { value: "web", label: "Web", note: "The chat in this app." },
  { value: "whatsapp", label: "WhatsApp", note: "Not available yet." },
  { value: "imessage", label: "iMessage", note: "Not available yet." },
];

// Money is stored in cents and edited in dollars.
const toDollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (dollars: string) => Math.round(Number(dollars) * 100);

export function AgentSettingsForm({ initial }: { initial: Settings }) {
  const [autoRebook, setAutoRebook] = useState(initial.autoRebook);
  const [perBooking, setPerBooking] = useState(toDollars(initial.perBookingCapCents));
  const [monthly, setMonthly] = useState(toDollars(initial.monthlyCapCents));
  const [channels, setChannels] = useState<Channel[]>(initial.allowedChannels);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(channel: Channel) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel],
    );
    setStatus("idle");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/agent-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          autoRebook,
          perBookingCapCents: toCents(perBooking),
          monthlyCapCents: toCents(monthly),
          allowedChannels: channels,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status}).`);
      }
      setPerBooking(toDollars(data.perBookingCapCents));
      setMonthly(toDollars(data.monthlyCapCents));
      setStatus("saved");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Could not save settings.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-8">
      <Card className="p-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={autoRebook}
            onChange={(e) => {
              setAutoRebook(e.target.checked);
              setStatus("idle");
            }}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="font-semibold">Rebook automatically</span>
            <span className="mt-0.5 block text-sm text-muted">
              When a flight is delayed or cancelled, Passage books the
              replacement without asking, within the caps below. Off means it
              suggests and waits for you.
            </span>
          </span>
        </label>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Spending caps</h2>
        <p className="mt-0.5 text-sm text-muted">
          The most Passage may spend for you without asking first. Anything
          above a cap comes to you as a question.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MoneyField
            label="Per booking"
            value={perBooking}
            onChange={(v) => {
              setPerBooking(v);
              setStatus("idle");
            }}
          />
          <MoneyField
            label="Per month"
            value={monthly}
            onChange={(v) => {
              setMonthly(v);
              setStatus("idle");
            }}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Channels</h2>
        <p className="mt-0.5 text-sm text-muted">
          Where Passage may reach you.
        </p>
        <ul className="mt-3 space-y-2">
          {CHANNELS.map((c) => (
            <li key={c.value}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={channels.includes(c.value)}
                  onChange={() => toggleChannel(c.value)}
                  className="h-4 w-4 accent-accent"
                />
                <span>{c.label}</span>
                <span className="text-sm text-muted">{c.note}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving" : "Save"}
        </Button>
        {status === "saved" && <span className="text-sm text-muted">Saved.</span>}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </form>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-muted">{label}</span>
      <span className="mt-1.5 flex items-center rounded-control border border-border bg-bg focus-within:border-accent">
        <span className="pl-3.5 text-muted">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-2 py-2.5 text-base text-fg outline-none"
        />
        <span className="pr-3.5 text-muted">USD</span>
      </span>
    </label>
  );
}

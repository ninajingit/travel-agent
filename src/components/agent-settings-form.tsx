"use client";

import { useState } from "react";
import { Button, Card, ErrorText, Pill } from "@/components/ui";

type Channel = "web" | "whatsapp" | "imessage";

type Settings = {
  autoRebook: boolean;
  perBookingCapCents: number;
  perTripCapCents: number;
  monthlyCapCents: number;
  allowedChannels: Channel[];
};

// Channels Nomi does not deliver on yet. Connect explains itself instead
// of doing anything.
const UPCOMING_CHANNELS: Array<{ value: Channel; label: string; note: string }> = [
  { value: "whatsapp", label: "WhatsApp", note: "Messages and alerts on WhatsApp." },
  { value: "imessage", label: "iMessage", note: "Messages and alerts on iMessage." },
];

// Money is stored in cents and edited in dollars.
const toDollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (dollars: string) => Math.round(Number(dollars) * 100);

export function AgentSettingsForm({ initial }: { initial: Settings }) {
  const [autoRebook, setAutoRebook] = useState(initial.autoRebook);
  const [perBooking, setPerBooking] = useState(toDollars(initial.perBookingCapCents));
  const [perTrip, setPerTrip] = useState(toDollars(initial.perTripCapCents));
  const [monthly, setMonthly] = useState(toDollars(initial.monthlyCapCents));
  const channels = initial.allowedChannels;
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

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
          perTripCapCents: toCents(perTrip),
          monthlyCapCents: toCents(monthly),
          allowedChannels: channels,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status}).`);
      }
      setPerBooking(toDollars(data.perBookingCapCents));
      setPerTrip(toDollars(data.perTripCapCents));
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
              When a flight is delayed or cancelled, Nomi books the
              replacement without asking, within the caps below. Off means it
              suggests and waits for you.
            </span>
          </span>
        </label>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Spending caps</h2>
        <p className="mt-0.5 text-sm text-muted">
          The most Nomi may spend for you without asking first. Anything
          above a cap comes to you as a question.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MoneyField
            label="Per booking"
            value={perBooking}
            onChange={(v) => {
              setPerBooking(v);
              setStatus("idle");
            }}
          />
          <MoneyField
            label="Per trip"
            value={perTrip}
            onChange={(v) => {
              setPerTrip(v);
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
        <p className="mt-0.5 text-sm text-muted">Where Nomi may reach you.</p>
        <ul className="mt-3 divide-y divide-border">
          <li className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="font-medium">Web</div>
              <div className="text-sm text-muted">The chat in this app.</div>
            </div>
            <Pill tone="accent">Connected</Pill>
          </li>
          {UPCOMING_CHANNELS.map((c) => (
            <ChannelRow key={c.value} label={c.label} note={c.note} />
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

function ChannelRow({ label, note }: { label: string; note: string }) {
  const [asked, setAsked] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted">
          {asked ? `Not available yet. Nomi will tell you when ${label} is ready.` : note}
        </div>
      </div>
      <Button type="button" variant="secondary" onClick={() => setAsked(true)} disabled={asked}>
        {asked ? "Requested" : "Connect"}
      </Button>
    </li>
  );
}

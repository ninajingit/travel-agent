"use client";

import { useState } from "react";
import { Button, Card, EmptyState, ErrorText, Field } from "@/components/ui";

// Client side of /app/destinations. The server page passes the first render;
// after that every change goes through the API routes and the returned row
// replaces the local copy, so what you see is what the database has.

type Destination = {
  id: number;
  name: string;
  country: string;
  notes: string | null;
};

type Draft = { name: string; country: string; notes: string };

const emptyDraft: Draft = { name: "", country: "", notes: "" };

async function callApi(method: string, path: string, body?: Draft) {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status}).`);
  }
  return data as Destination;
}

export function DestinationList({ initial }: { initial: Destination[] }) {
  const [rows, setRows] = useState(initial);

  function replace(row: Destination) {
    setRows((current) =>
      current
        .map((r) => (r.id === row.id ? row : r))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <AddForm
        onAdded={(row) =>
          setRows((current) =>
            [...current, row].sort((a, b) => a.name.localeCompare(b.name)),
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState>
          Nothing saved yet. Add a place you are curious about and Mira
          will start watching fares and collecting ideas.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map((row) => (
            <DestinationRow
              key={row.id}
              row={row}
              onChanged={replace}
              onArchived={(id) =>
                setRows((current) => current.filter((r) => r.id !== id))
              }
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function AddForm({ onAdded }: { onAdded: (row: Destination) => void }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await callApi("POST", "/api/destinations", draft));
      setDraft(emptyDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add destination.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-card border border-border bg-surface p-5 sm:grid-cols-[1fr_1fr_auto]"
    >
      <Field
        label="Name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Lisbon"
      />
      <Field
        label="Country"
        value={draft.country}
        onChange={(e) => setDraft({ ...draft, country: e.target.value })}
        placeholder="Portugal"
      />
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Adding" : "Add"}
        </Button>
      </div>
      <div className="sm:col-span-3">
        <Field
          label="Notes"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Optional. Dates that work, who is coming, anything the agent should know."
        />
      </div>
      {error && <ErrorText className="sm:col-span-3">{error}</ErrorText>}
    </form>
  );
}

function DestinationRow({
  row,
  onChanged,
  onArchived,
}: {
  row: Destination;
  onChanged: (row: Destination) => void;
  onArchived: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: row.name,
    country: row.country,
    notes: row.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onChanged(await callApi("PATCH", `/api/destinations/${row.id}`, draft));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!confirm(`Remove ${row.name} from Inspiration? Trips that use it are kept.`)) return;
    setBusy(true);
    setError(null);
    try {
      await callApi("DELETE", `/api/destinations/${row.id}`);
      onArchived(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove.");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="p-5">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Field
            label="Country"
            value={draft.country}
            onChange={(e) => setDraft({ ...draft, country: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          {error && <ErrorText className="sm:col-span-2">{error}</ErrorText>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="font-display text-lg font-bold">
          {row.name}
          <span className="ml-2 text-sm font-medium text-muted">
            {row.country}
          </span>
        </div>
        {row.notes && <p className="mt-1 text-sm text-muted">{row.notes}</p>}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEditing(true)}
          disabled={busy}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={archive}
          disabled={busy}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

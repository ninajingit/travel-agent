"use client";

import { useState } from "react";

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
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Nothing saved yet. Add a place you are curious about and Passage
          will start watching fares and collecting ideas.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
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
        </ul>
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
      className="grid gap-3 rounded-md border border-zinc-200 p-4 sm:grid-cols-[1fr_1fr_auto] dark:border-zinc-800"
    >
      <Field
        label="Name"
        value={draft.name}
        onChange={(name) => setDraft({ ...draft, name })}
        placeholder="Lisbon"
      />
      <Field
        label="Country"
        value={draft.country}
        onChange={(country) => setDraft({ ...draft, country })}
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
          onChange={(notes) => setDraft({ ...draft, notes })}
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
      <li className="p-4">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <Field
            label="Country"
            value={draft.country}
            onChange={(country) => setDraft({ ...draft, country })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Notes"
              value={draft.notes}
              onChange={(notes) => setDraft({ ...draft, notes })}
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
    <li className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="font-medium">
          {row.name}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {row.country}
          </span>
        </div>
        {row.notes && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {row.notes}
          </p>
        )}
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

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-zinc-500 dark:border-zinc-700"
      />
    </label>
  );
}

function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const look =
    variant === "primary"
      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
      : "border border-zinc-300 dark:border-zinc-700";
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${look} ${className}`}
    />
  );
}

function ErrorText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-red-700 dark:text-red-400 ${className}`}>
      {children}
    </p>
  );
}

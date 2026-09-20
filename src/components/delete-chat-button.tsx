"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";

// Confirm, delete, then let the caller decide what happens to the screen.
export function DeleteChatButton({
  conversationId,
  title,
  onDeleted,
  variant = "ghost",
}: {
  conversationId: number;
  title: string;
  onDeleted: () => void;
  variant?: "ghost" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/${conversationId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${response.status}).`);
      }
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" variant={variant} onClick={remove} disabled={busy} className="px-3 py-1.5">
        {busy ? "Deleting" : "Delete"}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </span>
  );
}

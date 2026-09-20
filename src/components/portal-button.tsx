"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";

// Asks the server for a Customer Portal link and goes there. A button rather
// than a link because the URL is made per visit and expires.
export function PortalButton({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal?returnTo=/app/membership", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not open the billing portal.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach the billing portal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant={variant} onClick={open} disabled={busy}>
        {busy ? "Opening…" : children}
      </Button>
      {error && <ErrorText className="mt-2">{error}</ErrorText>}
    </div>
  );
}

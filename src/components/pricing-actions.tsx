"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, ErrorText } from "@/components/ui";

type Offer = "plus" | "pro";

async function startCheckout(offer: Offer) {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ offer }),
  });
  const body = await response.json();
  if (response.ok && body.url) {
    window.location.href = body.url;
    return null;
  }
  return {
    message: body.error ?? "Could not start checkout.",
    portalUrl: body.portalUrl as string | undefined,
  };
}

/**
 * Starts a membership. Signed out, it goes through sign-in first and comes
 * back with ?start=<offer>, which AutoStart picks up, so the click is not
 * lost on the way.
 */
export function StartButton({
  offer,
  label,
  signedIn,
  variant = "primary",
}: {
  offer: Offer;
  label: string;
  signedIn: boolean;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; portalUrl?: string } | null>(null);

  if (!signedIn) {
    const back = encodeURIComponent(`/pricing?start=${offer}`);
    return (
      <ButtonLink href={`/sign-in?redirect_url=${back}`} variant={variant} className="w-full">
        {label}
      </ButtonLink>
    );
  }

  async function go() {
    setBusy(true);
    setError(null);
    const failure = await startCheckout(offer).catch(() => ({
      message: "Could not reach checkout. Try again.",
      portalUrl: undefined,
    }));
    if (failure) setError(failure);
    setBusy(false);
  }

  return (
    <div>
      <Button variant={variant} onClick={go} disabled={busy} className="w-full">
        {busy ? "Opening…" : label}
      </Button>
      {error && (
        <div className="mt-2">
          <ErrorText>{error.message}</ErrorText>
          {error.portalUrl && (
            <a href={error.portalUrl} className="text-sm underline text-muted hover:text-fg">
              Manage your membership
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Picks up the offer someone chose before signing in and resumes it. */
export function AutoStart({ offer }: { offer: Offer }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startCheckout(offer)
      .then((failure) => {
        if (!cancelled && failure) setError(failure.message);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach checkout. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [offer]);

  if (!error) {
    return (
      <p className="mt-4 text-sm text-muted" role="status">
        Taking you to checkout…
      </p>
    );
  }
  return <ErrorText className="mt-4">{error}</ErrorText>;
}

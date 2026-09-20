"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatRelative } from "@/lib/format";
import { ButtonLink } from "@/components/ui";

// The chat button that follows you around the app: bottom right on every
// signed-in page. Opens a small panel with a New chat button and the most
// recent threads, fetched when the panel opens so it is never stale.

type Thread = {
  id: number;
  title: string;
  destination: string | null;
  lastAt: string;
};

export function ChatLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close whenever the route changes.
  useEffect(() => {
    const close = () => setOpen(false);
    close();
  }, [pathname]);

  // Fetch on open; close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/conversations")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status}).`);
        return (await r.json()) as Thread[];
      })
      .then((rows) => {
        if (!cancelled) setThreads(rows.slice(0, 6));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load chats.");
      });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 rounded-card border border-border bg-surface p-3 shadow-2xl">
          <ButtonLink href="/app/chats" className="w-full">
            New chat
          </ButtonLink>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Recent
          </div>
          {error ? (
            <p className="mt-2 text-sm text-danger">{error}</p>
          ) : threads === null ? (
            <p className="mt-2 text-sm text-muted">Loading</p>
          ) : threads.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No chats yet.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/app/chats/${t.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent"
                  >
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className="shrink-0 text-xs text-muted">{formatRelative(t.lastAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/chats" className="mt-2 block text-sm text-muted hover:text-fg">
            All chats →
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chats" : "Open chats"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition hover:brightness-105 active:brightness-95"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 5 5.3 8 8 0 0 1 21 12z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

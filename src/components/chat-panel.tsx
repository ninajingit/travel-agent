"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText } from "@/components/ui";

// The chat. Renders a thread and a composer; every send goes to /api/chat and
// the returned messages (the person's and the agent's) are appended. With no
// conversationId the first send starts a thread and the URL moves to it.

export type ChatMessage = {
  id: number;
  role: "user" | "agent";
  body: string;
  createdAt: string | Date;
};

const STARTERS = [
  "Plan a long weekend under $3,000",
  "Book the Lisbon flights",
  "Are there any earlier flights I can get on standby?",
  "How much is it to change my flights and hotel to come home a day later?",
  "What should I do near the hotel tonight?",
];

export function ChatPanel({
  conversationId,
  tripId,
  initialMessages,
  compact = false,
}: {
  conversationId?: number;
  tripId?: number;
  initialMessages: ChatMessage[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, tripId, message }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status}).`);
      }
      setMessages((current) => [...current, ...data.messages]);
      if (!conversationId) {
        router.replace(`/app/chats/${data.conversationId}`);
      }
    } catch (e) {
      setDraft(message);
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-6">
          <p className="text-muted">
            Ask about a trip you are planning, something to book, or what is
            happening on a trip right now.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-fg transition hover:border-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className={`flex flex-col gap-3 ${compact ? "max-h-[28rem] overflow-y-auto pr-1" : ""}`}>
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-3 text-[15px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-accent text-accent-fg"
                    : "border border-border bg-surface text-fg"
                }`}
              >
                {m.body}
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-muted">
                Passage is typing
              </div>
            </li>
          )}
          <div ref={endRef} />
        </ol>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-end gap-2 rounded-card border border-border bg-surface p-2 focus-within:border-accent"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={1}
          placeholder="Message Passage"
          className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-fg outline-none placeholder:text-muted/60"
        />
        <Button type="submit" disabled={busy || draft.trim() === ""}>
          Send
        </Button>
      </form>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

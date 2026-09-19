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

// Example requests, typed and erased in the empty composer so a new person
// sees the range of things to ask without a wall of buttons.
const EXAMPLES = [
  "Plan a long weekend under $3,000",
  "Book the Lisbon flights",
  "Are there any earlier flights I can get on standby?",
  "How much is it to change my flights and hotel to come home a day later?",
  "What should I do near the hotel tonight?",
  "Can we squeeze in two nights in Hokkaido?",
  "Get me an aisle seat on the way back",
  "It is raining tomorrow, what should I do instead?",
];

const TYPE_MS = 38;
const ERASE_MS = 14;
const HOLD_MS = 1600;
const GAP_MS = 500;

// Cycles through EXAMPLES: type it out, hold, erase, next. Off when `active`
// is false (there is a thread, or the person has started typing) and for
// people who asked their OS for reduced motion.
function useTypewriter(active: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!active) {
      setText("");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(EXAMPLES[0]);
      return;
    }

    let index = 0;
    let length = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const example = EXAMPLES[index];
      if (!erasing) {
        length += 1;
        setText(example.slice(0, length));
        if (length === example.length) {
          erasing = true;
          timer = setTimeout(step, HOLD_MS);
        } else {
          timer = setTimeout(step, TYPE_MS);
        }
      } else {
        length -= 1;
        setText(example.slice(0, length));
        if (length === 0) {
          erasing = false;
          index = (index + 1) % EXAMPLES.length;
          timer = setTimeout(step, GAP_MS);
        } else {
          timer = setTimeout(step, ERASE_MS);
        }
      }
    };
    timer = setTimeout(step, GAP_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return text;
}

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
  const placeholder = useTypewriter(messages.length === 0 && draft === "");

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
      {messages.length === 0 ? null : (
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
          placeholder={messages.length === 0 ? placeholder || "Message Passage" : "Message Passage"}
          aria-label="Message Passage"
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

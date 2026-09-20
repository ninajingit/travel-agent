"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRelative } from "@/lib/format";
import { Card } from "@/components/ui";
import { DeleteChatButton } from "@/components/delete-chat-button";

// The "Earlier" list on the Chats page. Client side so a deleted thread
// disappears without a reload.

type Thread = {
  id: number;
  title: string;
  destination: string | null;
  count: number;
  lastAt: string | Date;
};

export function ChatList({ initial }: { initial: Thread[] }) {
  const [threads, setThreads] = useState(initial);

  if (threads.length === 0) {
    return (
      <p className="mt-3 text-muted">
        No chats yet. Your conversations with Mira will be listed here.
      </p>
    );
  }

  return (
    <Card className="mt-3 divide-y divide-border">
      {threads.map((t) => (
        <div key={t.id} className="flex items-center gap-3 p-4">
          <Link href={`/app/chats/${t.id}`} className="min-w-0 flex-1 hover:text-accent">
            <div className="truncate font-semibold">{t.title}</div>
            <div className="mt-0.5 text-sm text-muted">
              {t.destination ? `${t.destination} · ` : ""}
              {t.count} {t.count === 1 ? "message" : "messages"}
            </div>
          </Link>
          <div className="shrink-0 text-sm text-muted">{formatRelative(t.lastAt)}</div>
          <DeleteChatButton
            conversationId={t.id}
            title={t.title}
            onDeleted={() => setThreads((c) => c.filter((x) => x.id !== t.id))}
          />
        </div>
      ))}
    </Card>
  );
}

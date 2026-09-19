import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { listConversations } from "@/db/queries/conversations";
import { formatRelative } from "@/lib/format";
import { ChatPanel } from "@/components/chat-panel";
import { Card, PageHeader } from "@/components/ui";

export default async function ChatsPage() {
  const user = await ensureUser();
  const threads = await listConversations(user.id);

  return (
    <div>
      <PageHeader
        title="Chats"
        intro="Start something new, or pick up where a thread left off."
      />

      <div className="mt-8">
        <ChatPanel initialMessages={[]} />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Earlier
      </h2>
      {threads.length === 0 ? (
        <p className="mt-3 text-muted">
          No chats yet. Your conversations with Passage will be listed here.
        </p>
      ) : (
        <Card className="mt-3 divide-y divide-border">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/app/chats/${t.id}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{t.title}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {t.destination ? `${t.destination} · ` : ""}
                  {t.count} {t.count === 1 ? "message" : "messages"}
                </div>
              </div>
              <div className="shrink-0 text-sm text-muted">
                {formatRelative(t.lastAt)}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

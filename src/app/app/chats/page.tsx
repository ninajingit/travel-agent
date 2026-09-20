import { ensureUser } from "@/lib/auth";
import { listConversations } from "@/db/queries/conversations";
import { ChatPanel } from "@/components/chat-panel";
import { PageHeader } from "@/components/ui";
import { ChatList } from "@/components/chat-list";

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
      <ChatList initial={threads} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUser } from "@/lib/auth";
import { parseId } from "@/lib/api";
import { getConversation } from "@/db/queries/conversations";
import { getTrip } from "@/db/queries/trips";
import { ChatPanel } from "@/components/chat-panel";
import { DeleteChatAndLeave } from "@/components/delete-chat-and-leave";

export default async function ChatPage({ params }: PageProps<"/app/chats/[id]">) {
  const user = await ensureUser();
  const id = parseId((await params).id);
  const conversation = id ? await getConversation(user.id, id) : null;
  if (!conversation) notFound();

  const trip = conversation.tripId
    ? await getTrip(user.id, conversation.tripId)
    : null;

  return (
    <div>
      <Link href="/app/chats" className="text-sm text-muted hover:text-fg">
        ← Chats
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {conversation.title}
        </h1>
        <DeleteChatAndLeave conversationId={conversation.id} title={conversation.title} />
      </div>
      {trip && (
        <p className="mt-1 text-sm text-muted">
          About your{" "}
          <Link href={`/app/trips/${trip.id}`} className="underline hover:text-fg">
            {trip.destination.name} trip
          </Link>
        </p>
      )}
      <div className="mt-6">
        <ChatPanel
          conversationId={conversation.id}
          tripId={conversation.tripId ?? undefined}
          initialMessages={conversation.messages}
        />
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { DeleteChatButton } from "@/components/delete-chat-button";

// Delete from inside a thread, then go back to the list.
export function DeleteChatAndLeave({ conversationId, title }: { conversationId: number; title: string }) {
  const router = useRouter();
  return (
    <DeleteChatButton
      conversationId={conversationId}
      title={title}
      variant="secondary"
      onDeleted={() => router.push("/app/chats")}
    />
  );
}

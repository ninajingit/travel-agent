import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import { notFound, parseId, unauthorized } from "@/lib/api";
import { deleteConversation } from "@/db/queries/conversations";

// Delete a past chat. Gone means gone; there is no archive for threads.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/chat/[id]">) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const id = parseId((await params).id);
  if (!id) return notFound();

  const removed = await deleteConversation(user.id, id);
  return removed ? NextResponse.json({ id }) : notFound();
}

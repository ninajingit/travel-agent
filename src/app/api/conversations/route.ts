import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { listConversations } from "@/db/queries/conversations";

// Recent threads for the floating chat button. Same data as the Chats page.
export async function GET() {
  const user = await signedInUser();
  if (!user) return unauthorized();

  return NextResponse.json(await listConversations(user.id));
}

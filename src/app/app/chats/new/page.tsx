import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUser } from "@/lib/auth";
import { parseId } from "@/lib/api";
import { getTrip } from "@/db/queries/trips";
import { ChatPanel } from "@/components/chat-panel";

// A fresh thread attached to a trip. The first send creates the conversation
// and the URL moves to it.
export default async function NewChatPage({ searchParams }: PageProps<"/app/chats/new">) {
  const user = await ensureUser();
  const raw = (await searchParams).trip;
  const tripId = typeof raw === "string" ? parseId(raw) : null;
  const trip = tripId ? await getTrip(user.id, tripId) : null;
  if (!trip) notFound();

  return (
    <div>
      <Link href="/app" className="text-sm text-muted hover:text-fg">
        ← Home
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        About your {trip.destination.name} trip
      </h1>
      <div className="mt-6">
        <ChatPanel tripId={trip.id} initialMessages={[]} />
      </div>
    </div>
  );
}

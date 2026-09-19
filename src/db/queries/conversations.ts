import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, destinations, messages, trips } from "@/db/schema";

// Threads for the history list: newest activity first, with a one-line
// preview of the latest message and the trip it belongs to, if any.
export async function listConversations(userId: number) {
  const latest = db
    .select({
      conversationId: messages.conversationId,
      lastAt: sql<Date>`max(${messages.createdAt})`.as("last_at"),
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(messages)
    .groupBy(messages.conversationId)
    .as("latest");

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      tripId: conversations.tripId,
      destination: destinations.name,
      lastAt: latest.lastAt,
      count: latest.count,
    })
    .from(conversations)
    .innerJoin(latest, eq(latest.conversationId, conversations.id))
    .leftJoin(trips, eq(trips.id, conversations.tripId))
    .leftJoin(destinations, eq(destinations.id, trips.destinationId))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(latest.lastAt));

  return rows;
}

export async function getConversation(userId: number, id: number) {
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
  if (!conversation) return null;

  const thread = await db.query.messages.findMany({
    where: eq(messages.conversationId, id),
    orderBy: asc(messages.createdAt),
  });
  return { ...conversation, messages: thread };
}

export async function createConversation(
  userId: number,
  title: string,
  tripId: number | null,
) {
  const [row] = await db
    .insert(conversations)
    .values({ userId, title, tripId })
    .returning();
  return row;
}

export async function appendMessage(
  conversationId: number,
  role: "user" | "agent",
  body: string,
) {
  const [row] = await db
    .insert(messages)
    .values({ conversationId, role, body })
    .returning();
  return row;
}

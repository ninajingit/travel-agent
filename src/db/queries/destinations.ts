import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { destinations } from "@/db/schema";

// Every function takes the owning userId first and never returns another
// person's rows. A missing or foreign id comes back as null.

export type DestinationInput = {
  name: string;
  country: string;
  notes: string | null;
};

export function listDestinations(userId: number) {
  return db.query.destinations.findMany({
    where: and(eq(destinations.userId, userId), isNull(destinations.archivedAt)),
    orderBy: asc(destinations.name),
  });
}

export async function createDestination(userId: number, input: DestinationInput) {
  const [row] = await db
    .insert(destinations)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function updateDestination(
  userId: number,
  id: number,
  patch: Partial<DestinationInput>,
) {
  const [row] = await db
    .update(destinations)
    .set(patch)
    .where(and(eq(destinations.id, id), eq(destinations.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveDestination(userId: number, id: number) {
  const [row] = await db
    .update(destinations)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(destinations.id, id),
        eq(destinations.userId, userId),
        isNull(destinations.archivedAt),
      ),
    )
    .returning();
  return row ?? null;
}

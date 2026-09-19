import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

// Returns the users row for the signed-in person, creating it on their first
// visit. Clerk owns the identity; this row is what the rest of the schema
// points at. Cached per request so a layout and a page can both call it and
// only one query runs.
export const ensureUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("ensureUser called without a signed-in user");
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });
  if (existing) {
    return existing;
  }

  // First visit: fetch the profile from Clerk once and store what we need.
  const profile = await currentUser();
  if (!profile) {
    throw new Error(`Clerk user ${userId} not found`);
  }
  const email =
    profile.primaryEmailAddress?.emailAddress ??
    profile.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error(`Clerk user ${userId} has no email address`);
  }
  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null;

  const [created] = await db
    .insert(users)
    .values({ clerkId: userId, email, name })
    .onConflictDoUpdate({ target: users.clerkId, set: { email, name } })
    .returning();
  return created;
});

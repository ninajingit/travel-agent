// Seeds the demo account. Safe to run repeatedly: every write is an upsert
// keyed on something stable, so a second run changes nothing.
//
//   SEED_EMAIL=you@example.com npm run db:seed
//
// The person must already exist in Clerk (sign up once first). Later commits
// add seed functions for their own tables below seedUser.
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";

async function seedUser(email: string) {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const profile = data[0];
  if (!profile) {
    throw new Error(`No Clerk user with email ${email}. Sign up first.`);
  }
  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null;

  const [user] = await db
    .insert(users)
    .values({ clerkId: profile.id, email, name })
    .onConflictDoUpdate({ target: users.clerkId, set: { email, name } })
    .returning();
  return user;
}

async function main() {
  const email = process.env.SEED_EMAIL;
  if (!email) {
    throw new Error("SEED_EMAIL is not set.");
  }

  const user = await seedUser(email);
  console.log(`user      ${user.id}  ${user.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

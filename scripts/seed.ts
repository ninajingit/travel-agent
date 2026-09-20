// Seeds the demo data for one account from the command line. Safe to run
// repeatedly. The app does the same thing on its own the first time a person
// signs in (see ensureUser in src/lib/auth.ts); this exists for re-seeding a
// database or seeding an account that has not visited yet.
//
//   SEED_EMAIL=you@example.com npm run db:seed
//
// The person must already exist in Clerk (sign up once first).
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { seedDemoData } from "@/lib/demo";

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
  console.log(`user          ${user.id}  ${user.email}`);

  const result = await seedDemoData(user.id);
  console.log(`destinations  ${result.destinations}`);
  console.log(`trips         ${result.trips}`);
  console.log(`settings      ok`);
  console.log(`chats         ${result.chats.total} total, ${result.chats.created} new`);
  console.log(`transactions  ${result.transactions.total} total, ${result.transactions.created} new`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

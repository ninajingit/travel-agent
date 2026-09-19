// Seeds the demo account. Safe to run repeatedly: every write is an upsert
// keyed on something stable, so a second run changes nothing.
//
//   SEED_EMAIL=you@example.com npm run db:seed
//
// The person must already exist in Clerk (sign up once first). Later commits
// add seed functions for their own tables below seedUser.
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { destinations, users } from "@/db/schema";

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

const DESTINATIONS = [
  { name: "Lisbon", country: "Portugal", notes: "Prefer TAP nonstop from EWR." },
  { name: "Tokyo", country: "Japan", notes: "Late March if fares allow." },
  { name: "Mexico City", country: "Mexico", notes: null },
];

async function seedDestinations(userId: number) {
  const rows = [];
  for (const input of DESTINATIONS) {
    const existing = await db.query.destinations.findFirst({
      where: and(
        eq(destinations.userId, userId),
        eq(destinations.name, input.name),
      ),
    });
    if (existing) {
      rows.push(existing);
      continue;
    }
    const [row] = await db
      .insert(destinations)
      .values({ userId, ...input })
      .returning();
    rows.push(row);
  }
  return rows;
}

async function main() {
  const email = process.env.SEED_EMAIL;
  if (!email) {
    throw new Error("SEED_EMAIL is not set.");
  }

  const user = await seedUser(email);
  console.log(`user          ${user.id}  ${user.email}`);

  const places = await seedDestinations(user.id);
  console.log(`destinations  ${places.map((d) => d.id).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

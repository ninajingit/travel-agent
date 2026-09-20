import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  agentSettings, agentTransactions, conversations, destinations,
  messages, subscriptions, tripSegments, trips, users,
} from "@/db/schema";
import { seedDemoData } from "@/lib/demo";
import { refreshDemoForPlan } from "@/lib/demo/tier";

const tag = Math.random().toString(36).slice(2, 8);
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function snapshot(userId: number) {
  const t = await db.select().from(trips).where(eq(trips.userId, userId));
  const ids = t.map((x) => x.id);
  const segs = ids.length ? await db.select().from(tripSegments).where(inArray(tripSegments.tripId, ids)) : [];
  const chats = await db.select().from(conversations).where(eq(conversations.userId, userId));
  const tx = await db.select().from(agentTransactions).where(eq(agentTransactions.userId, userId));
  const places = await db.select().from(destinations).where(eq(destinations.userId, userId));
  return { trips: t, segs, chats, tx, places };
}

async function main() {
  const [user] = await db.insert(users).values({
    clerkId: `tier_${tag}`, email: `tier_${tag}@example.test`, name: "Tier",
  }).returning();

  try {
    // A brand new account: Free.
    await seedDemoData(user.id, "free");
    const s = await snapshot(user.id);
    console.log("FREE");
    check("saved places are all there", s.places.length === 3);
    check("both trips exist", s.trips.length === 2);
    check("every trip is a plan", s.trips.every((t) => t.status === "planned"));
    check("no itinerary, so no confirmation codes", s.segs.length === 0);
    check("only the seven planning chats", s.chats.length === 7);
    check("no booking history", s.tx.length === 0);

    // They upgrade.
    await db.insert(subscriptions).values({
      userId: user.id, stripeSubscriptionId: `sub_tier_${tag}`, plan: "plus",
      status: "active", priceLookupKey: "plus_monthly",
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
      cancelAtPeriodEnd: false,
    });
    await refreshDemoForPlan(user.id);
    const after = await snapshot(user.id);
    console.log("\nAFTER UPGRADE");
    check("same two trips, not duplicated", after.trips.length === 2);
    check("trips filled in to booked and in progress", after.trips.some((t) => t.status === "booked") && after.trips.some((t) => t.status === "in_progress"));
    check("itineraries appeared", after.segs.length > 0);
    check("the delayed flight is there", after.segs.some((x) => x.status === "delayed"));
    check("the five membership chats appeared", after.chats.length === 12);
    check("booking history appeared", after.tx.length === 4);
    check("same saved places, not duplicated", after.places.length === 3);

    // Running it again must change nothing.
    await refreshDemoForPlan(user.id);
    const again = await snapshot(user.id);
    console.log("\nRUN AGAIN");
    check("no duplicate trips", again.trips.length === 2);
    check("no duplicate segments", again.segs.length === after.segs.length);
    check("no duplicate chats", again.chats.length === 12);
    check("no duplicate history", again.tx.length === 4);
  } finally {
    const t = await db.select({ id: trips.id }).from(trips).where(eq(trips.userId, user.id));
    const ids = t.map((x) => x.id);
    const chats = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.userId, user.id));
    if (chats.length) await db.delete(messages).where(inArray(messages.conversationId, chats.map((c) => c.id)));
    await db.delete(conversations).where(eq(conversations.userId, user.id));
    await db.delete(agentTransactions).where(eq(agentTransactions.userId, user.id));
    if (ids.length) await db.delete(tripSegments).where(inArray(tripSegments.tripId, ids));
    await db.delete(trips).where(eq(trips.userId, user.id));
    await db.delete(destinations).where(eq(destinations.userId, user.id));
    await db.delete(agentSettings).where(eq(agentSettings.userId, user.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    console.log("\ncleaned up");
  }
}
main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e); process.exit(1); });

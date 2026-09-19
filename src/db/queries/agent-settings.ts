import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentSettings } from "@/db/schema";

export type AgentSettingsInput = {
  autoRebook: boolean;
  perBookingCapCents: number;
  monthlyCapCents: number;
  allowedChannels: Array<"web" | "whatsapp" | "imessage">;
};

// Settings for a user, created with the column defaults the first time they
// are asked for so callers never see a missing row.
export async function getAgentSettings(
  userId: number,
): Promise<typeof agentSettings.$inferSelect> {
  const existing = await db.query.agentSettings.findFirst({
    where: eq(agentSettings.userId, userId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(agentSettings)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  // A concurrent first request may have won the insert; read it back.
  return created ?? (await getAgentSettings(userId));
}

export async function saveAgentSettings(userId: number, input: AgentSettingsInput) {
  const [row] = await db
    .insert(agentSettings)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: agentSettings.userId, set: input })
    .returning();
  return row;
}

import type { DemoTier } from "@/lib/demo";
import { getEntitlement } from "@/lib/billing/entitlement";
import { seedDemoData } from "@/lib/demo";

/**
 * How far the demo should be filled in for this person.
 *
 * "booking" the moment the account can have Mira act at all: any membership,
 * or a Concierge Pass on a trip. Free is planning only.
 */
export async function demoTierFor(userId: number): Promise<DemoTier> {
  const entitlement = await getEntitlement(userId);
  const canAct = entitlement.plan !== "free" || entitlement.passes.length > 0;
  return canAct ? "booking" : "free";
}

/**
 * Bring the demo up to date with what this account can now do.
 *
 * Called when the plan changes rather than on every request, because the
 * seed is a dozen queries and nothing below a plan change can alter the
 * answer. Safe to run repeatedly; it only ever fills in what is missing.
 */
export async function refreshDemoForPlan(userId: number) {
  const tier = await demoTierFor(userId);
  if (tier !== "booking") return null;
  return seedDemoData(userId, tier);
}

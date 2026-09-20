import { ensureUser } from "@/lib/auth";
import { getAgentSettings } from "@/db/queries/agent-settings";
import { getEntitlement } from "@/lib/billing/entitlement";
import { AgentSettingsForm } from "@/components/agent-settings-form";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const user = await ensureUser();
  const [settings, entitlement] = await Promise.all([
    getAgentSettings(user.id),
    getEntitlement(user.id),
  ]);

  // Auto-rebook is the one setting the plan decides. A pass turns it on for
  // the trip it covers, which is a per-trip fact and cannot be a switch here.
  return (
    <div>
      <PageHeader
        title="Agent settings"
        intro="What the concierge may do on its own while you travel, and how much it may spend before it has to ask you."
      />
      <AgentSettingsForm
        initial={settings}
        autoRebookAllowed={entitlement.plan === "pro"}
        plan={entitlement.plan}
        passCount={entitlement.passes.length}
      />
    </div>
  );
}

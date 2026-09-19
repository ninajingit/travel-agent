import { ensureUser } from "@/lib/auth";
import { getAgentSettings } from "@/db/queries/agent-settings";
import { AgentSettingsForm } from "@/components/agent-settings-form";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const user = await ensureUser();
  const settings = await getAgentSettings(user.id);

  return (
    <div>
      <PageHeader
        title="Agent settings"
        intro="What the concierge may do on its own while you travel, and how much it may spend before it has to ask you."
      />
      <AgentSettingsForm initial={settings} />
    </div>
  );
}

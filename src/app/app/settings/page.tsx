import { ensureUser } from "@/lib/auth";
import { getAgentSettings } from "@/db/queries/agent-settings";
import { AgentSettingsForm } from "@/components/agent-settings-form";

export default async function SettingsPage() {
  const user = await ensureUser();
  const settings = await getAgentSettings(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Agent settings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        What the concierge may do on its own while you travel, and how much it
        may spend before it has to ask you.
      </p>
      <AgentSettingsForm initial={settings} />
    </div>
  );
}

import { ensureUser } from "@/lib/auth";
import { listDestinations } from "@/db/queries/destinations";
import { DestinationList } from "@/components/destination-list";

export default async function DestinationsPage() {
  const user = await ensureUser();
  const rows = await listDestinations(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Inspiration</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Places you are curious about. Save one and Passage starts planning
        around it: dates, fares, and what is worth doing there.
      </p>
      <DestinationList initial={rows} />
    </div>
  );
}

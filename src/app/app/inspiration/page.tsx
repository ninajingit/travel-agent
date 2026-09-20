import { ensureUser } from "@/lib/auth";
import { listDestinations } from "@/db/queries/destinations";
import { DestinationList } from "@/components/destination-list";
import { PageHeader } from "@/components/ui";

export default async function InspirationPage() {
  const user = await ensureUser();
  const rows = await listDestinations(user.id);

  return (
    <div>
      <PageHeader
        title="Inspiration"
        intro="Places you are curious about. Save one and Mira starts planning around it: dates, fares, and what is worth doing there."
      />
      <DestinationList initial={rows} />
    </div>
  );
}

import { ensureUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export default async function AppHome() {
  const user = await ensureUser();

  return (
    <div>
      <PageHeader
        title="Home"
        intro={`Signed in as ${user.email}. Chat and what is coming up will live here.`}
      />
    </div>
  );
}

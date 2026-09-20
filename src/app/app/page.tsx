import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { listTrips } from "@/db/queries/trips";
import {
  formatCountdown,
  formatDateRange,
  tripStatusLabel,
  tripStatusTone,
} from "@/lib/format";
import { inspirationFor, type Idea } from "@/lib/inspiration";
import { ChatPanel } from "@/components/chat-panel";
import { ButtonLink, Card, Pill } from "@/components/ui";

export default async function AppHome() {
  const user = await ensureUser();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (await listTrips(user.id)).filter(
    (t) =>
      t.status !== "complete" &&
      t.status !== "cancelled" &&
      (t.status === "in_progress" || t.endsAt >= today),
  );
  const firstName = user.name?.split(" ")[0];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {firstName ? `Hi ${firstName}.` : "Hi."} Where shall we go?
      </h1>
      <div className="mt-6">
        <ChatPanel initialMessages={[]} />
      </div>

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-muted">
        Coming up
      </h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-muted">
          Nothing on the calendar. Ask Mira to plan something, or save a
          place under Inspiration.
        </p>
      ) : (
        <div className="mt-3 grid gap-4">
          {upcoming.map((trip) => {
            const ideas = inspirationFor(trip.destination.name);
            return (
              <Card key={trip.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-2xl font-bold">
                      {trip.destination.name}
                      <span className="ml-2 text-base font-medium text-muted">
                        {trip.destination.country}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {formatDateRange(trip.startsAt, trip.endsAt)} ·{" "}
                      {formatCountdown(trip.startsAt, trip.endsAt)}
                    </div>
                  </div>
                  <Pill tone={tripStatusTone(trip.status)}>
                    {tripStatusLabel(trip.status)}
                  </Pill>
                </div>

                {ideas ? (
                  <div className="mt-5 grid gap-5 sm:grid-cols-3">
                    <IdeaList heading="Events" ideas={ideas.events} />
                    <IdeaList heading="Places" ideas={ideas.places} />
                    <IdeaList heading="Things to do" ideas={ideas.thingsToDo} />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-muted">
                    Mira has not collected ideas for {trip.destination.name}{" "}
                    yet. Ask it what is worth doing there.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href={`/app/chats/new?trip=${trip.id}`} variant="secondary">
                    Ask about this trip
                  </ButtonLink>
                  <Link
                    href={`/app/trips/${trip.id}`}
                    className="inline-flex items-center px-3 text-sm font-medium text-muted hover:text-fg"
                  >
                    Open itinerary →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IdeaList({ heading, ideas }: { heading: string; ideas: Idea[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {heading}
      </h3>
      <ul className="mt-2 space-y-3">
        {ideas.map((idea) => (
          <li key={idea.title}>
            <div className="text-sm font-semibold">{idea.title}</div>
            <div className="mt-0.5 text-sm leading-snug text-muted">{idea.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

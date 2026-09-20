import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUser } from "@/lib/auth";
import { getTrip } from "@/db/queries/trips";
import { parseId } from "@/lib/api";
import {
  formatDateRange,
  formatDateTime,
  formatMoney,
  segmentKindLabel,
  segmentStatusLabel,
  segmentStatusTone,
  tripStatusLabel,
  tripStatusTone,
} from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { MonitoringPanel } from "@/components/monitoring-panel";
import { reportFor } from "@/lib/agent/monitoring";
import { getAgentSettings } from "@/db/queries/agent-settings";
import { canAutoRebook, getEntitlement } from "@/lib/billing/entitlement";

export default async function TripPage({ params }: PageProps<"/app/trips/[id]">) {
  const user = await ensureUser();
  const id = parseId((await params).id);
  const trip = id ? await getTrip(user.id, id) : null;
  if (!trip) notFound();

  // Monitoring: the first delayed segment gets the panel. Watched trips with
  // nothing wrong get one quiet line.
  const delayed = trip.segments.find((s) => s.status === "delayed");
  const report = delayed ? reportFor(delayed) : null;
  const watching = trip.status === "booked" || trip.status === "in_progress";
  const settings = delayed ? await getAgentSettings(user.id) : null;
  // Wanting auto-rebook and being allowed it are two different things. The
  // panel says which, rather than promising something the plan will refuse.
  const entitlement = delayed ? await getEntitlement(user.id) : null;
  const autoRebookAllowed = entitlement
    ? canAutoRebook(entitlement, trip.id)
    : false;

  return (
    <div>
      <Link href="/app/trips" className="text-sm text-muted hover:text-fg">
        ← My Trips
      </Link>

      <div className="mt-4">
        <PageHeader
          title={
            <>
              {trip.destination.name}
              <span className="ml-3 text-xl font-medium text-muted sm:text-2xl">
                {trip.destination.country}
              </span>
            </>
          }
          intro={formatDateRange(trip.startsAt, trip.endsAt)}
          aside={
            <Pill tone={tripStatusTone(trip.status)}>
              {tripStatusLabel(trip.status)}
            </Pill>
          }
        />
      </div>

      {delayed && report && settings ? (
        <div className="mt-8">
          <MonitoringPanel
            tripId={trip.id}
            segmentId={delayed.id}
            carrier={delayed.carrier}
            delayMinutes={report.delayMinutes}
            reason={report.reason}
            autoRebook={settings.autoRebook}
            autoRebookAllowed={autoRebookAllowed}
            replacement={
              report.replacement
                ? {
                    carrier: report.replacement.carrier,
                    departLabel: formatDateTime(report.replacement.departAt),
                    arriveLabel: formatDateTime(report.replacement.arriveAt),
                    amountLabel: formatMoney(report.replacement.amountCents),
                    summary: report.replacement.summary,
                  }
                : null
            }
          />
        </div>
      ) : watching ? (
        <p className="mt-8 text-sm text-muted">
          Mira is watching this trip. Nothing needs your attention right now.
        </p>
      ) : null}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Itinerary
      </h2>
      {trip.segments.length === 0 ? (
        <div className="mt-3">
          <EmptyState>
            Nothing booked yet. Flights, stays, and trains show up here as
            Mira books them.
          </EmptyState>
        </div>
      ) : (
        <Card className="mt-3 divide-y divide-border">
          {trip.segments.map((segment) => (
            <div
              key={segment.id}
              className="grid gap-2 p-5 sm:grid-cols-[5rem_1fr_auto] sm:items-start"
            >
              <div className="text-sm font-medium text-muted">
                {segmentKindLabel(segment.kind)}
              </div>
              <div>
                <div className="font-semibold">{segment.carrier}</div>
                <div className="mt-1 text-sm text-muted">
                  {formatDateTime(segment.departAt)} →{" "}
                  {formatDateTime(segment.arriveAt)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted">
                  {segment.ref}
                </div>
              </div>
              <Pill tone={segmentStatusTone(segment.status)}>
                {segmentStatusLabel(segment.status)}
              </Pill>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

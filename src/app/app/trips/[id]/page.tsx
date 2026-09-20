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
import { canAutoRebook, getEntitlement, hasPass } from "@/lib/billing/entitlement";
import { CheckoutReturn } from "@/components/checkout-return";
import { PassPurchase } from "@/components/pass-purchase";

// trips.ends_at is a calendar date string, not a timestamp.
function formatDay(endsAt: string) {
  return new Date(`${endsAt}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function TripPage({
  params,
  searchParams,
}: PageProps<"/app/trips/[id]">) {
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
  const entitlement = await getEntitlement(user.id);
  const autoRebookAllowed = canAutoRebook(entitlement, trip.id);

  const pass = entitlement.passes.find((p) => p.tripId === trip.id) ?? null;
  const covered = hasPass(entitlement, trip.id);
  // A pass buys the rest of a trip, so there is nothing to sell once it is over.
  const finished = new Date(`${trip.endsAt}T23:59:59.999Z`) < new Date();

  const query = await searchParams;
  const sessionId =
    query.checkout === "success" && typeof query.session_id === "string"
      ? query.session_id
      : null;

  return (
    <div>
      <Link href="/app/trips" className="text-sm text-muted hover:text-fg">
        ← My Trips
      </Link>

      {sessionId && !covered && (
        <div className="mt-4">
          <CheckoutReturn sessionId={sessionId} kind="pass" />
        </div>
      )}

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

      <div className="mt-8">
        {covered && pass ? (
          <Card className="border-accent p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Pill tone="accent">Covered</Pill>
              <span className="font-semibold">Concierge Pass</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Mira has this trip until {formatDay(pass.coversUntil)}: booking,
              watching, and rebooking, inside the caps you set. Nothing it does
              here counts against your allowance.
            </p>
          </Card>
        ) : finished ? null : (
          <Card className="p-5">
            <p className="font-semibold">Concierge Pass, $150</p>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {entitlement.plan === "free"
                ? "Mira cannot book on the free plan. A pass puts it on this one trip: it books, watches, and rebooks you until you are home, with no membership."
                : `Everything in Pro for this trip alone, until you are home. Nothing Mira does here counts against your ${entitlement.actionsAllowed} actions.`}
            </p>
            <div className="mt-4">
              <PassPurchase tripId={trip.id} />
            </div>
          </Card>
        )}
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

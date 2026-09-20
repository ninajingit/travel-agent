import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { getEntitlement, type Entitlement } from "@/lib/billing/entitlement";
import { listTrips } from "@/db/queries/trips";
import { formatMoney } from "@/lib/format";
import { Card, ButtonLink, EmptyState, PageHeader, Pill } from "@/components/ui";
import { CheckoutReturn } from "@/components/checkout-return";
import { PortalButton } from "@/components/portal-button";

const PLAN_NAME = { free: "Free", plus: "Plus", pro: "Pro" } as const;

const PLAN_SUMMARY = {
  free: "Planning and inspiration. When you want something booked, Mira hands you the links.",
  plus: "Mira books flights, hotels, and trains for you, and watches every trip.",
  pro: "Everything in Plus, plus auto-rebook and a person from the Mira team on the thread.",
} as const;

function formatDay(value: Date) {
  return value.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// What the state of the membership is, in one sentence, in Mira's voice.
function statusLine(entitlement: Entitlement) {
  const renews = formatDay(entitlement.periodEnd);

  if (entitlement.plan === "free") {
    return "You are on the free plan. Nothing to pay, nothing to cancel.";
  }
  if (entitlement.status === "trialing" && entitlement.trialEnd) {
    return `Free until ${formatDay(entitlement.trialEnd)}. Your card is charged then, not before.`;
  }
  if (entitlement.cancelAtPeriodEnd) {
    return `Ends on ${renews}. Until then nothing changes.`;
  }
  if (entitlement.pastDue) {
    return `Renews on ${renews} once the payment goes through.`;
  }
  return `Renews on ${renews}.`;
}

export default async function MembershipPage({
  searchParams,
}: PageProps<"/app/membership">) {
  const user = await ensureUser();
  const entitlement = await getEntitlement(user.id);
  const trips = await listTrips(user.id);
  const tripName = new Map(trips.map((trip) => [trip.id, trip.destination.name]));

  const isFree = entitlement.plan === "free";

  // Just back from Stripe. If the mirror already has the membership the
  // webhook won the race and there is nothing to wait for; otherwise confirm
  // the session so this page does not greet a paying customer with "Free".
  const params = await searchParams;
  const justPaid = params.checkout === "success";
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  const waiting = justPaid && isFree && sessionId !== null;
  const used = entitlement.actionsUsed;
  const allowed = entitlement.actionsAllowed;
  const pct = allowed > 0 ? Math.min(100, Math.round((used / allowed) * 100)) : 0;

  return (
    <div>
      <PageHeader
        title="Membership"
        intro="What Mira is allowed to do for you, and what it costs."
      />

      {waiting && sessionId && <CheckoutReturn sessionId={sessionId} />}

      {justPaid && !isFree && (
        <Card className="mt-8 border-accent p-5">
          <p className="font-semibold">You are on {PLAN_NAME[entitlement.plan]}.</p>
          <p className="mt-1 text-sm text-muted">
            Mira can book and watch trips for you from now on. The receipt is in
            your email.
          </p>
        </Card>
      )}

      {isFree && entitlement.lapsed && (
        <Card className="mt-8 border-danger p-5">
          <p className="font-semibold text-danger">
            {entitlement.lapsed.status === "unpaid"
              ? "Your membership stopped because the payment could not be taken."
              : `Your ${PLAN_NAME[entitlement.lapsed.plan]} membership ended on ${formatDay(entitlement.lapsed.endedAt)}.`}
          </p>
          <p className="mt-1 text-sm text-muted">
            Planning and inspiration still work. Trips Mira already booked are
            still yours; it just will not book or rebook anything new.
          </p>
          <div className="mt-4">
            <ButtonLink href="/pricing">See the plans</ButtonLink>
          </div>
        </Card>
      )}

      {entitlement.pastDue && (
        <Card className="mt-8 border-warn p-5">
          <p className="font-semibold text-warn">Your last payment did not go through.</p>
          <p className="mt-1 text-sm text-muted">
            Mira is still working as normal. Stripe will try the card again over
            the next few days. Updating it now avoids the interruption.
          </p>
          <div className="mt-4">
            <PortalButton variant="primary">Update your card</PortalButton>
          </div>
        </Card>
      )}

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold">
                {PLAN_NAME[entitlement.plan]}
              </h2>
              {entitlement.status === "trialing" && <Pill tone="violet">Trial</Pill>}
              {entitlement.cancelAtPeriodEnd && <Pill tone="warn">Ending</Pill>}
              {entitlement.pastDue && <Pill tone="danger">Payment failed</Pill>}
            </div>
            <p className="mt-2 max-w-md text-sm text-muted">
              {PLAN_SUMMARY[entitlement.plan]}
            </p>
            <p className="mt-3 text-sm" data-testid="status-line">
              {statusLine(entitlement)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {isFree ? (
              // The lapse notice above already offers this; twice reads like
              // a sales pitch rather than an explanation.
              entitlement.lapsed ? null : (
                <ButtonLink href="/pricing">See the plans</ButtonLink>
              )
            ) : (
              <>
                <PortalButton>Manage membership</PortalButton>
                <p className="max-w-[14rem] text-xs text-muted">
                  Change plan, update your card, see invoices, or cancel.
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      <h2 className="mt-10 font-display text-xl font-bold">Agent actions</h2>
      <p className="mt-1 text-sm text-muted">
        An action is a booking, a rebooking, or a cancellation Mira carries out.
        Planning and watching are never counted.
      </p>

      <Card className="mt-4 p-6">
        {isFree ? (
          <p className="text-sm text-muted">
            Free does not include agent actions. Mira will plan anything you ask
            and hand you the links to book it yourself.
          </p>
        ) : (
          <>
            <p className="font-display text-2xl font-bold" data-testid="actions-used">
              {used} of {allowed} actions this period
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted">
              {formatDay(entitlement.periodStart)} to {formatDay(entitlement.periodEnd)}.
              {entitlement.actionsLeft === 0
                ? " You have used them all. Actions will be refused until the period resets."
                : ` ${entitlement.actionsLeft} left.`}
            </p>
            <p className="mt-2 text-sm">
              <Link href="/app/activity" className="text-muted underline hover:text-fg">
                See what Mira did
              </Link>
            </p>
          </>
        )}
      </Card>

      <h2 className="mt-10 font-display text-xl font-bold">Concierge Passes</h2>
      <p className="mt-1 text-sm text-muted">
        A pass covers one trip from the day you buy it until you are home.
        Actions on a covered trip never count against your allowance.
      </p>

      <div className="mt-4">
        {entitlement.passes.length === 0 ? (
          <EmptyState>
            No passes. You can buy one on any trip when you want Mira on it
            without a membership.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-border">
            {entitlement.passes.map((pass) => (
              <div
                key={pass.tripId}
                className="flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div>
                  <Link
                    href={`/app/trips/${pass.tripId}`}
                    className="font-semibold hover:underline"
                  >
                    {tripName.get(pass.tripId) ?? `Trip ${pass.tripId}`}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    Covered until {formatDay(new Date(`${pass.coversUntil}T00:00:00Z`))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">
                    {formatMoney(pass.amountCents, pass.currency)}
                  </span>
                  <Pill tone="accent">Covered</Pill>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

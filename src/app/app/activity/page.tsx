import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import {
  listTransactionsBetween,
  monthBounds,
} from "@/db/queries/agent-transactions";
import {
  getEntitlement,
  isCovered,
  passCoverage,
} from "@/lib/billing/entitlement";
import {
  formatDateTime,
  formatMoney,
  formatMonth,
  transactionKindLabel,
  transactionKindTone,
} from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { CancelBooking } from "@/components/cancel-booking";
import { refundedIntents } from "@/lib/billing/refund";

function formatDay(value: Date) {
  return value.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * What the agent did with money.
 *
 * The default view is the billing period, because that is the window the
 * allowance is counted over and the only one where "3 of 10" means anything.
 * Earlier calendar months are still browsable with ?month=, but they are
 * shown as a plain log: an allowance from a period that has closed is not a
 * number anyone can act on.
 */
export default async function ActivityPage({ searchParams }: PageProps<"/app/activity">) {
  const user = await ensureUser();
  const raw = (await searchParams).month;
  const browsing = typeof raw === "string" ? parseMonth(raw) : null;

  const [entitlement, coverage, refunded] = await Promise.all([
    getEntitlement(user.id),
    passCoverage(user.id),
    refundedIntents(user.id),
  ]);

  const window = browsing
    ? monthBounds(browsing.year, browsing.month)
    : { start: entitlement.periodStart, end: entitlement.periodEnd };

  const rows = await listTransactionsBetween(user.id, window.start, window.end);
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const covered = rows.filter((row) => isCovered(coverage, row.tripId, row.occurredAt));
  const countedRows = rows.length - covered.length;

  const showAllowance = !browsing && entitlement.actionsAllowed > 0;
  const heading = browsing
    ? formatMonth(browsing.year, browsing.month)
    : entitlement.hasBillingPeriod
      ? "This period"
      : formatMonth(window.start.getUTCFullYear(), window.start.getUTCMonth() + 1);

  const previousMonth = shiftMonth(
    window.start.getUTCFullYear(),
    window.start.getUTCMonth() + 1,
    -1,
  );

  return (
    <div>
      <PageHeader
        title="Activity"
        intro="Every time Mira books, rebooks, or cancels something for you, it is listed here."
      />

      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold">{heading}</h2>
          {browsing && (
            <Link href="/app/activity" className="text-sm text-muted underline hover:text-fg">
              Back to this period
            </Link>
          )}
        </div>

        <p className="mt-1 text-sm text-muted" data-testid="running-count">
          {showAllowance ? (
            <>
              {countedRows} of {entitlement.actionsAllowed} actions this period
            </>
          ) : (
            <>
              {rows.length} {rows.length === 1 ? "action" : "actions"}
            </>
          )}
          {rows.length > 0 ? ` · ${formatMoney(totalCents)}` : ""}
        </p>

        <p className="mt-1 text-sm text-muted">
          {formatDay(window.start)} to {formatDay(window.end)}.
          {covered.length > 0 &&
            ` ${covered.length} ${covered.length === 1 ? "action is" : "actions are"} covered by a Concierge Pass and not counted.`}
          {!browsing && !entitlement.hasBillingPeriod &&
            " On the free plan this is a calendar month, since there is no billing period to count."}
        </p>

        <p className="mt-2 text-sm">
          <Link href={`/app/activity?month=${previousMonth}`} className="text-muted underline hover:text-fg">
            ← {formatMonth(Number(previousMonth.slice(0, 4)), Number(previousMonth.slice(5)))}
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState>
            Nothing {browsing ? `in ${heading}` : "yet in this period"}. When Mira
            books, rebooks, or cancels something for you, it shows up here.
          </EmptyState>
        </div>
      ) : (
        <Card className="mt-4 divide-y divide-border">
          {rows.map((row) => {
            const onPass = isCovered(coverage, row.tripId, row.occurredAt);
            return (
              <div key={row.id} className="grid gap-2 p-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-start sm:gap-4">
                <div className="text-sm text-muted">{formatDateTime(row.occurredAt)}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={transactionKindTone(row.kind)}>{transactionKindLabel(row.kind)}</Pill>
                    {onPass && <Pill tone="violet">Covered by pass</Pill>}
                    {row.tripId && row.destination && (
                      <Link href={`/app/trips/${row.tripId}`} className="text-sm text-muted hover:text-fg">
                        {row.destination} trip →
                      </Link>
                    )}
                  </div>
                  <div className="mt-1.5 text-sm">{row.description}</div>
                {row.kind !== "cancellation" &&
                  row.stripePaymentIntentId &&
                  !refunded.has(row.stripePaymentIntentId) && (
                    <div className="mt-2">
                      <CancelBooking transactionId={row.id} />
                    </div>
                  )}
                </div>
                <div className="font-mono text-sm font-semibold sm:text-right">
                  {formatMoney(row.amountCents, row.currency)}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function parseMonth(raw: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

function shiftMonth(year: number, month: number, by: number) {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

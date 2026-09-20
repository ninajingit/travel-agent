import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { listTransactionsForMonth } from "@/db/queries/agent-transactions";
import {
  formatDateTime,
  formatMoney,
  formatMonth,
  transactionKindLabel,
  transactionKindTone,
} from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";

// A plain log of what the agent did with money, one month at a time.
// ?month=YYYY-MM picks the month; the default is the current one.
export default async function ActivityPage({ searchParams }: PageProps<"/app/activity">) {
  const user = await ensureUser();
  const { year, month } = pickMonth((await searchParams).month);
  const rows = await listTransactionsForMonth(user.id, year, month);
  const totalCents = rows.reduce((sum, r) => sum + r.amountCents, 0);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const now = new Date();
  const isCurrent = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;

  return (
    <div>
      <PageHeader
        title="Activity"
        intro="Every time Nomi books, rebooks, or cancels something for you, it is listed here."
      />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/app/activity?month=${prev}`} className="text-muted hover:text-fg" aria-label="Previous month">
              ←
            </Link>
            <h2 className="font-display text-xl font-bold">{formatMonth(year, month)}</h2>
            {!isCurrent && (
              <Link href={`/app/activity?month=${next}`} className="text-muted hover:text-fg" aria-label="Next month">
                →
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-muted" data-testid="running-count">
            {rows.length} {rows.length === 1 ? "action" : "actions"}
            {isCurrent ? " so far this month" : ""}
            {rows.length > 0 ? ` · ${formatMoney(totalCents)}` : ""}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState>
            Nothing {isCurrent ? "yet this month" : `in ${formatMonth(year, month)}`}. When
            Nomi books, rebooks, or cancels something for you, it shows up here.
          </EmptyState>
        </div>
      ) : (
        <Card className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-2 p-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-start sm:gap-4">
              <div className="text-sm text-muted">{formatDateTime(row.occurredAt)}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={transactionKindTone(row.kind)}>{transactionKindLabel(row.kind)}</Pill>
                  {row.tripId && row.destination && (
                    <Link href={`/app/trips/${row.tripId}`} className="text-sm text-muted hover:text-fg">
                      {row.destination} trip →
                    </Link>
                  )}
                </div>
                <div className="mt-1.5 text-sm">{row.description}</div>
              </div>
              <div className="font-mono text-sm font-semibold sm:text-right">
                {formatMoney(row.amountCents, row.currency)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function pickMonth(raw: string | string[] | undefined) {
  const now = new Date();
  const fallback = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  if (typeof raw !== "string") return fallback;
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : fallback;
}

function shiftMonth(year: number, month: number, by: number) {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

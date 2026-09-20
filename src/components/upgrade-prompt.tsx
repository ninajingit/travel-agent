import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { TRIAL_DAYS } from "@/lib/billing/checkout";

/**
 * What Mira would do here, and the three ways to let it.
 *
 * Shown where the limit is actually felt, rather than as a banner following
 * people around: an empty activity list, a trip with no itinerary. The tone
 * is what the persona asks for, plain and specific about what is missing,
 * with no exclamation marks and nothing sold twice.
 *
 * `tripId` turns the pass into a real purchase link for that trip; without
 * it the pass is described but not sold, since a pass is always for one trip.
 */
export function UpgradePrompt({
  heading,
  children,
  tripId,
  trialAvailable,
}: {
  heading: string;
  children: React.ReactNode;
  tripId?: number;
  trialAvailable: boolean;
}) {
  return (
    <Card className="mt-4 border-dashed p-6">
      <p className="font-display text-lg font-bold">{heading}</p>
      <p className="mt-2 max-w-xl text-sm text-muted">{children}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ButtonLink href="/pricing">
          {trialAvailable ? `Try Pro free for ${TRIAL_DAYS} days` : "See the plans"}
        </ButtonLink>
        <Link href="/pricing" className="text-sm text-muted underline hover:text-fg">
          Plus, $29 a month
        </Link>
        {tripId && (
          <Link
            href={`/app/trips/${tripId}`}
            className="text-sm text-muted underline hover:text-fg"
          >
            Or a Concierge Pass for this trip, $150
          </Link>
        )}
      </div>

      {trialAvailable && (
        <p className="mt-3 text-xs text-muted">
          The trial takes a card and charges nothing until day {TRIAL_DAYS + 1}.
          Cancel before then and it never does.
        </p>
      )}
    </Card>
  );
}

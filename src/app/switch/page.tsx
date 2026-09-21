import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MarketingShell } from "@/components/marketing-shell";
import { StartButton } from "@/components/pricing-actions";
import { Card } from "@/components/ui";
import { ensureUser } from "@/lib/auth";
import { TRIAL_DAYS } from "@/lib/billing/checkout";
import { linkLegacyCustomer, verifySwitchToken } from "@/lib/billing/migration";

export const metadata: Metadata = {
  title: "Move to a membership · Mira",
  description: "Bring your Mira history onto a monthly plan.",
  robots: { index: false, follow: false },
};

/**
 * Where the migration email lands.
 *
 * Our URL rather than a Stripe one, because a Checkout Session expires in
 * under 24 hours and people read email on their own schedule. The Stripe
 * session is created when they press a button on this page, not when the
 * email is sent.
 */
export default async function SwitchPage({ searchParams }: PageProps<"/switch">) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : null;
  const legacyCustomerId = verifySwitchToken(token);
  const { userId } = await auth();
  const signedIn = Boolean(userId);

  if (!legacyCustomerId) {
    return (
      <MarketingShell signedIn={signedIn}>
        <section className="py-20">
          <h1 className="font-display text-4xl font-bold">That link has expired or been altered.</h1>
          <p className="mt-4 max-w-xl text-muted">
            Ask us for a new one and we will send it over. Nothing has changed
            on your account in the meantime.
          </p>
          <p className="mt-6">
            <Link href="/pricing" className="underline">
              See the plans
            </Link>
          </p>
        </section>
      </MarketingShell>
    );
  }

  // Signed out, we cannot bind anything yet, so send them through sign-in and
  // back to this same URL with the token intact.
  if (!signedIn) {
    const back = `/switch?t=${encodeURIComponent(token!)}`;
    return (
      <MarketingShell signedIn={false}>
        <section className="py-20">
          <h1 className="max-w-2xl font-display text-4xl font-bold sm:text-5xl">
            Same Mira. One price a month instead of one per booking.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            You have been paying $20 each time Mira booked something. We do not
            sell that any more. Sign in and pick a plan, and everything you have
            paid for so far stays on your account.
          </p>
          <p className="mt-8">
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(back)}`}
              className="rounded-control bg-accent px-5 py-3 font-semibold text-accent-fg"
            >
              Sign in to continue
            </Link>
          </p>
          <p className="mt-4 text-sm text-muted">
            No account yet? The same button will make one.
          </p>
        </section>
      </MarketingShell>
    );
  }

  const user = await ensureUser();
  const linked = await linkLegacyCustomer(user, legacyCustomerId);

  return (
    <MarketingShell signedIn>
      <section className="py-16 sm:py-20">
        <h1 className="max-w-2xl font-display text-4xl font-bold sm:text-5xl">
          Pick a plan and your old payments come with you.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          You paid $20 each time Mira booked something. A membership covers ten
          or fifty of those a month, and adds the watching: delays, gate
          changes, fare drops.
        </p>
        {!linked.ok && (
          <p className="mt-4 max-w-xl text-sm text-warn">
            Your old payments are already attached to a different Mira account.
            You can still start a plan here, but the two histories will stay
            separate. Tell us and we will put them together.
          </p>
        )}
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-2xl font-bold">Plus</h2>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold">$29</span>
            <span className="text-sm text-muted">per month</span>
          </div>
          <p className="mt-3 font-medium">Ten bookings a month, all of them watched.</p>
          <p className="mt-2 text-sm text-muted">
            Two bookings a month and you are already better off.
          </p>
          <div className="mt-6">
            <StartButton offer="plus" label="Move to Plus" signedIn variant="secondary" />
          </div>
        </Card>

        <Card className="border-accent p-6">
          <h2 className="font-display text-2xl font-bold">Pro</h2>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold">$99</span>
            <span className="text-sm text-muted">per month</span>
          </div>
          {user.trialUsedAt === null && (
            <p className="mt-2 text-sm font-semibold text-accent">
              First {TRIAL_DAYS} days free
            </p>
          )}
          <p className="mt-3 font-medium">Fifty a month, and Mira rebooks without asking.</p>
          <p className="mt-2 text-sm text-muted">
            When a flight slips, it moves you and tells you afterwards.
          </p>
          <div className="mt-6">
            <StartButton offer="pro" label="Move to Pro" signedIn />
          </div>
        </Card>
      </section>

      <section className="pb-20">
        <p className="max-w-xl text-sm text-muted">
          Nothing is charged until you pick one. If you would rather keep paying
          per booking, reply to the email and we will sort something out.
        </p>
      </section>
    </MarketingShell>
  );
}

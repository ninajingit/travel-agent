import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MarketingShell } from "@/components/marketing-shell";
import { StripePricingTable } from "@/components/stripe-pricing-table";
import { ensureUser } from "@/lib/auth";
import { getOrCreateCustomer } from "@/lib/billing/checkout";
import { stripe } from "@/lib/billing/stripe";

export const metadata: Metadata = {
  title: "Pricing · Mira",
  description: "Planning and inspiration are free. Pay when Mira books and watches for you.",
};

/**
 * The real pricing page with Stripe's table in place of our own cards.
 *
 * Everything around it is the page as it ships: the same promise at the top,
 * the same questions at the bottom. Only the part that sells is Stripe's, so
 * the comparison is about that and nothing else.
 */
export default async function PricingTablePage() {
  const tableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const { userId } = await auth();
  const signedIn = Boolean(userId);

  let clientReferenceId: string | undefined;
  let customerSessionClientSecret: string | undefined;
  if (signedIn) {
    const user = await ensureUser();
    clientReferenceId = String(user.id);
    // Without this the table makes a second Stripe customer for someone who
    // already has one, and the webhook has nothing to match the person on.
    const customer = await getOrCreateCustomer(user);
    const session = await stripe().customerSessions.create({
      customer,
      components: { pricing_table: { enabled: true } },
    });
    customerSessionClientSecret = session.client_secret;
  }

  return (
    <MarketingShell signedIn={signedIn}>
      <section className="py-16 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          Comparison ·{" "}
          <Link href="/pricing" className="underline hover:text-fg">
            our own page
          </Link>
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl font-bold tracking-tight sm:text-6xl">
          Planning is free. Pay when Mira does the work.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Prices in US dollars. Whatever Mira spends on your behalf, flights,
          rooms, tickets, is separate, is always shown before it happens, and
          never goes past the caps you set.
        </p>
      </section>

      <section className="pb-6">
        {tableId && publishableKey ? (
          <StripePricingTable
            pricingTableId={tableId}
            publishableKey={publishableKey}
            clientReferenceId={clientReferenceId}
            customerSessionClientSecret={customerSessionClientSecret}
          />
        ) : (
          <p className="text-sm text-danger">
            Set NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID and
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to render the table.
          </p>
        )}
      </section>

      <section className="pb-20">
        <h2 className="font-display text-2xl font-bold">Questions people ask</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">What counts as an agent action?</dt>
            <dd className="mt-1 text-muted">
              One thing Mira does with money on your behalf: a booking, a
              rebooking, or a cancellation. Asking questions, planning, and
              watching are not actions and are never counted. Nor is a
              cancellation Mira makes to put its own mistake right.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Can Mira spend without asking?</dt>
            <dd className="mt-1 text-muted">
              Only if you turn on auto-rebook, and only inside the per-booking
              and monthly caps you set. Everything else is a question first.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Where do I see what it spent?</dt>
            <dd className="mt-1 text-muted">
              Activity lists every action, with the amount, the trip, and the
              time, by month.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Can I change or cancel later?</dt>
            <dd className="mt-1 text-muted">
              Any time, from Membership. Moving up takes effect at once. Moving
              down or cancelling takes effect at the end of the period you have
              already paid for, so nothing you are using disappears mid-trip.
            </dd>
          </div>
        </dl>
      </section>
    </MarketingShell>
  );
}

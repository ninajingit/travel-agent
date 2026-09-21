import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MarketingShell } from "@/components/marketing-shell";
import { AutoStart, StartButton } from "@/components/pricing-actions";
import { Card, ButtonLink, Pill } from "@/components/ui";
import { ensureUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing/entitlement";
import { TRIAL_DAYS } from "@/lib/billing/checkout";
import { localPrices, resolveCurrency } from "@/lib/billing/locale";
import { LocalPriceLine, LocalPriceNote } from "@/components/local-price";

export const metadata: Metadata = {
  title: "Pricing · Mira",
  description: "Planning and inspiration are free. Pay when Mira books and watches for you.",
};

// The copy is still the promise; now the buttons keep it. Signed out, a
// choice survives the trip through sign-in via ?start=. Signed in, the card
// you are already on says so instead of selling it to you again.
const OFFERS = [
  {
    name: "Free",
    cents: 0,
    price: "$0",
    cadence: "",
    summary: "Planning and inspiration.",
    details: [
      "Ask Mira to plan anything, as often as you like.",
      "Ideas for where you are going: events, places, things to do.",
      "Save places under Inspiration and see fares move.",
      "When you want something booked, Mira hands you the links.",
    ],
  },
  {
    name: "Plus",
    cents: 2900,
    price: "$29",
    cadence: "per month",
    summary: "Booking and monitoring for the regular traveller.",
    details: [
      "Everything in Free.",
      "Mira books flights, hotels, and trains for you, within the caps you set.",
      "Every trip is watched: delays, gate changes, fare drops on refundable tickets.",
      "Up to ten agent actions a month, where an action is a booking, a rebooking, or a cancellation Mira carries out. Most people use three or four.",
    ],
  },
  {
    name: "Pro",
    cents: 9900,
    price: "$99",
    cadence: "per month",
    summary: "The proactive concierge, for people who fly every month.",
    details: [
      "Everything in Plus.",
      "Auto-rebook: when a flight slips, Mira moves you and tells you afterwards, inside your caps.",
      "Up to fifty agent actions a month.",
      "A person from the Mira team on the thread when the agent cannot finish the job: group bookings, visa questions, fare rules.",
    ],
  },
  {
    name: "Concierge Pass",
    cents: 15000,
    price: "$150",
    cadence: "per trip",
    summary: "Everything in Pro, for one trip, without a membership.",
    details: [
      "Booking, monitoring, and auto-rebook from the day you buy it until you are home.",
      "Covers every segment of that trip, however many.",
      "Good for the once-a-year trip that actually matters.",
    ],
  },
];

function isOffer(value: unknown): value is "plus" | "pro" {
  return value === "plus" || value === "pro";
}

export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const { userId } = await auth();
  const signedIn = Boolean(userId);
  const user = signedIn ? await ensureUser() : null;
  const entitlement = user ? await getEntitlement(user.id) : null;
  // Signed out, the offer is real for anyone who has not taken it, so it is
  // advertised. Signed in, it is only advertised to someone who can have it.
  const trialOffered = user ? user.trialUsedAt === null : true;
  const currentPlan = entitlement?.plan ?? null;
  const subscribed = currentPlan === "plus" || currentPlan === "pro";

  // One mirror read for the whole page. Free is left out: nought is nought
  // in every currency and "about ￥0" is noise.
  const { currency, source } = await resolveCurrency();
  const local = await localPrices(
    OFFERS.map((o) => o.cents).filter((c) => c > 0),
    currency,
  );

  const requested = (await searchParams).start;
  const resuming = signedIn && !subscribed && isOffer(requested) ? requested : null;

  return (
    <MarketingShell signedIn={signedIn}>
      <section className="py-16 sm:py-20">
        <h1 className="max-w-2xl font-display text-5xl font-bold tracking-tight sm:text-6xl">
          Planning is free. Pay when Mira does the work.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Prices in US dollars. Whatever Mira spends on your behalf, flights,
          rooms, tickets, is separate, is always shown before it happens, and
          never goes past the caps you set.
        </p>
        {local && currency && <LocalPriceNote currency={currency} source={source} />}
        {resuming && <AutoStart offer={resuming} />}
      </section>

      <section className="grid gap-4 pb-20 lg:grid-cols-4">
        {OFFERS.map((offer) => (
          <Card key={offer.name} className={`p-6 ${offer.name === "Pro" ? "border-accent" : ""}`}>
            <h2 className="font-display text-2xl font-bold">{offer.name}</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold">{offer.price}</span>
              {offer.cadence && <span className="text-sm text-muted">{offer.cadence}</span>}
            </div>
            <LocalPriceLine price={local?.get(offer.cents) ?? null} cadence={offer.cadence} />
            {offer.name === "Pro" && trialOffered && !subscribed && (
              <p className="mt-2 text-sm font-semibold text-accent">
                First {TRIAL_DAYS} days free
              </p>
            )}
            <p className="mt-3 font-medium">{offer.summary}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {offer.details.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-accent">—</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <OfferAction
                offer={offer}
                signedIn={signedIn}
                currentPlan={currentPlan}
                subscribed={subscribed}
                trialOffered={trialOffered}
              />
            </div>
          </Card>
        ))}
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

type Offer = (typeof OFFERS)[number];

// What the card offers depends on where the reader already stands.
function OfferAction({
  offer,
  signedIn,
  currentPlan,
  subscribed,
  trialOffered,
}: {
  offer: Offer;
  signedIn: boolean;
  currentPlan: string | null;
  subscribed: boolean;
  trialOffered: boolean;
}) {
  const key = offer.name.toLowerCase();

  if (key === "free") {
    return currentPlan === "free" ? (
      <Pill>Your plan</Pill>
    ) : (
      <p className="text-sm text-muted">Included with every account.</p>
    );
  }

  if (key === "concierge pass") {
    return signedIn ? (
      <ButtonLink href="/app/trips" variant="secondary" className="w-full">
        Pick a trip
      </ButtonLink>
    ) : (
      <ButtonLink href="/sign-in" variant="secondary" className="w-full">
        Sign in to buy
      </ButtonLink>
    );
  }

  if (currentPlan === key) {
    return (
      <div className="flex flex-col gap-2">
        <Pill tone="accent">Your plan</Pill>
        <Link href="/app/membership" className="text-sm text-muted underline hover:text-fg">
          Manage membership
        </Link>
      </div>
    );
  }

  // Already paying for the other one: this is a plan change, which belongs in
  // the portal rather than a second checkout.
  if (subscribed) {
    return (
      <ButtonLink href="/app/membership" variant="secondary" className="w-full">
        Switch to {offer.name}
      </ButtonLink>
    );
  }

  const label =
    key === "pro" && trialOffered
      ? `Start ${TRIAL_DAYS} days free`
      : `Start ${offer.name}`;

  return (
    <div>
      <StartButton
        offer={key as "plus" | "pro"}
        label={label}
        signedIn={signedIn}
        variant={offer.name === "Pro" ? "primary" : "secondary"}
      />
      {key === "pro" && trialOffered && (
        <p className="mt-2 text-xs text-muted">
          Card required. Nothing is charged until day {TRIAL_DAYS + 1}, and you
          can cancel before then.
        </p>
      )}
    </div>
  );
}

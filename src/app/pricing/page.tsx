import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing · Passage",
  description: "Planning and inspiration are free. Pay when Passage books and watches for you.",
};

// Static copy. Nothing on this page reads data, checks who you are, or does
// anything when clicked.
const OFFERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    summary: "Planning and inspiration.",
    details: [
      "Ask Passage to plan anything, as often as you like.",
      "Ideas for where you are going: events, places, things to do.",
      "Save places under Inspiration and see fares move.",
      "When you want something booked, Passage hands you the links.",
    ],
  },
  {
    name: "Plus",
    price: "$29",
    cadence: "per month",
    summary: "Booking and monitoring for the regular traveller.",
    details: [
      "Everything in Free.",
      "Passage books flights, hotels, and trains for you, within the caps you set.",
      "Every trip is watched: delays, gate changes, fare drops on refundable tickets.",
      "Up to ten agent actions a month, where an action is a booking, a rebooking, or a cancellation Passage carries out. Most people use three or four.",
    ],
  },
  {
    name: "Pro",
    price: "$99",
    cadence: "per month",
    summary: "The proactive concierge, for people who fly every month.",
    details: [
      "Everything in Plus.",
      "Auto-rebook: when a flight slips, Passage moves you and tells you afterwards, inside your caps.",
      "Up to fifty agent actions a month.",
      "A person from the Passage team on the thread when the agent cannot finish the job: group bookings, visa questions, fare rules.",
    ],
  },
  {
    name: "Concierge Pass",
    price: "$100",
    cadence: "per trip",
    summary: "Everything in Pro, for one trip, without a membership.",
    details: [
      "Booking, monitoring, and auto-rebook from the day you buy it until you are home.",
      "Covers every segment of that trip, however many.",
      "Good for the once-a-year trip that actually matters.",
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="py-16 sm:py-20">
        <h1 className="max-w-2xl font-display text-5xl font-bold tracking-tight sm:text-6xl">
          Planning is free. Pay when Passage does the work.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Prices in US dollars. Whatever Passage spends on your behalf, flights,
          rooms, tickets, is separate, is always shown before it happens, and
          never goes past the caps you set.
        </p>
      </section>

      <section className="grid gap-4 pb-20 lg:grid-cols-4">
        {OFFERS.map((offer) => (
          <Card key={offer.name} className={`p-6 ${offer.name === "Pro" ? "border-accent" : ""}`}>
            <h2 className="font-display text-2xl font-bold">{offer.name}</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold">{offer.price}</span>
              {offer.cadence && <span className="text-sm text-muted">{offer.cadence}</span>}
            </div>
            <p className="mt-3 font-medium">{offer.summary}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {offer.details.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-accent">—</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>

      <section className="pb-20">
        <h2 className="font-display text-2xl font-bold">Questions people ask</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">What counts as an agent action?</dt>
            <dd className="mt-1 text-muted">
              One thing Passage does with money on your behalf: a booking, a
              rebooking, or a cancellation. Asking questions, planning, and
              watching are not actions and are never counted.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Can Passage spend without asking?</dt>
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
            <dt className="font-semibold">Is this available now?</dt>
            <dd className="mt-1 text-muted">
              Passage is in a closed pilot. Members pay per booking for now;
              memberships open with the next release.
            </dd>
          </div>
        </dl>
      </section>
    </MarketingShell>
  );
}

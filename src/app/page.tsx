import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { ButtonLink, Card } from "@/components/ui";

const JOBS = [
  {
    title: "Plan",
    body: "Say “long weekend, under four hours away, all in under $3,000” and get three real options with dates and prices, not a listicle.",
  },
  {
    title: "Inspire",
    body: "Know what is worth doing where you are going. The neighbourhood nobody’s cousin recommended, the thing that is only on this week.",
  },
  {
    title: "Book",
    body: "Flights, hotels, trains. Confirmation codes in one place, seats picked, receipts kept.",
  },
  {
    title: "Concierge",
    body: "While you travel, Passage watches. A flight slips, a gate changes, a bag goes missing: it acts, or asks, at 2am if it has to.",
  },
];

export default function Home() {
  return (
    <MarketingShell>
      <section className="py-16 sm:py-24">
        <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          The part of travel that is just phone calls and patience, handled.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Passage is an AI travel agent you talk to. It plans the trip, knows
          what is worth doing, books it, and stays on call until you are home.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/sign-in">Sign in</ButtonLink>
          <Link href="/pricing" className="px-3 text-sm font-medium text-muted hover:text-fg">
            See pricing →
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-2">
        {JOBS.map((job) => (
          <Card key={job.title} className="p-6">
            <h2 className="font-display text-2xl font-bold">{job.title}</h2>
            <p className="mt-2 text-muted">{job.body}</p>
          </Card>
        ))}
      </section>

      <section className="pb-20">
        <Card className="bg-surface-2 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">How a trip goes</h2>
          <ol className="mt-4 grid gap-4 text-muted sm:grid-cols-3">
            <li>
              <span className="font-semibold text-fg">1. You say where, or when, or how much.</span>{" "}
              Passage comes back with options you can actually take.
            </li>
            <li>
              <span className="font-semibold text-fg">2. You say yes.</span> It books, within
              the spending caps you set, and tells you exactly what it did.
            </li>
            <li>
              <span className="font-semibold text-fg">3. You travel.</span> It watches every
              segment and handles what changes. You see all of it in one activity list.
            </li>
          </ol>
        </Card>
      </section>
    </MarketingShell>
  );
}

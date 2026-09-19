import { ButtonLink } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
        Passage
      </h1>
      <p className="max-w-md text-lg text-muted">
        Plans your trips, knows what is worth doing, books it, and stays on
        call while you travel.
      </p>
      <ButtonLink href="/sign-in">Sign in</ButtonLink>
    </main>
  );
}

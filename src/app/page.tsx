import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">Passage</h1>
      <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
        An AI travel agent that plans trips, books them, and watches them.
      </p>
      <Link
        href="/sign-in"
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        Sign in
      </Link>
    </main>
  );
}

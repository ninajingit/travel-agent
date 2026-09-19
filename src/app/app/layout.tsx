import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureUser } from "@/lib/auth";

// Shell for every signed-in page. The proxy has already required a session,
// so ensureUser() here guarantees the users row exists before any page runs.
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await ensureUser();

  return (
    <div className="flex flex-1 flex-col font-sans">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <Link href="/app" className="font-semibold tracking-tight">
            Passage
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/app/trips">Trips</Link>
            <Link href="/app/destinations">Destinations</Link>
          </nav>
        </div>
        <UserButton />
      </header>
      <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}

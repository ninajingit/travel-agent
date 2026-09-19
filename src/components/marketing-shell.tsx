import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui";

// Header and footer for the public pages. No auth, no data: the same page for
// everyone.
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          Passage
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pricing" className="text-muted hover:text-fg">
            Pricing
          </Link>
          <ButtonLink href="/sign-in" variant="secondary" className="px-3.5 py-2">
            Sign in
          </ButtonLink>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-sm text-muted">
        Passage. The part of travel that is just phone calls and patience, handled.
      </footer>
    </div>
  );
}

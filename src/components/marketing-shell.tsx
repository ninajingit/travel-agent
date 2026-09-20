import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";

// Header and footer for the public pages. Public, but not identical for
// everyone: someone already signed in is offered their app, not a sign-in box.
export function MarketingShell({
  children,
  signedIn = false,
}: {
  children: ReactNode;
  signedIn?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark href="/" size="lg" />
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pricing" className="text-muted hover:text-fg">
            Pricing
          </Link>
          <ButtonLink
            href={signedIn ? "/app" : "/sign-in"}
            variant="secondary"
            className="px-3.5 py-2"
          >
            {signedIn ? "Open Mira" : "Sign in"}
          </ButtonLink>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-sm text-muted">
        Mira, by Llama Inc. The part of travel that is just phone calls and patience, handled.
      </footer>
    </div>
  );
}

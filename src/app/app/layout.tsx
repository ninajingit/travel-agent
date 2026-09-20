import { ensureUser } from "@/lib/auth";
import { AccountMenu } from "@/components/account-menu";
import { AppNav } from "@/components/app-nav";
import { BillingBanner } from "@/components/billing-banner";
import { ChatLauncher } from "@/components/chat-launcher";
import { Wordmark } from "@/components/wordmark";

// Shell for every signed-in page. The proxy has already required a session,
// so ensureUser() here guarantees the users row exists before any page runs.
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await ensureUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Wordmark href="/app" />
            <AppNav />
          </div>
          <AccountMenu />
        </div>
      </header>
      <BillingBanner />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-24">
        {children}
      </main>
      <ChatLauncher />
    </div>
  );
}

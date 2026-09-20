import Link from "next/link";
import { ensureUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing/entitlement";

/**
 * One line across every signed-in page when the money needs attention.
 *
 * It lives in the shell rather than on the membership page because the
 * person who most needs to see it is the one who never opens that page. It
 * says nothing at all when there is nothing to say.
 */
export async function BillingBanner() {
  const user = await ensureUser();
  const entitlement = await getEntitlement(user.id);

  if (entitlement.pastDue) {
    return (
      <Notice tone="warn">
        Your last payment did not go through. Mira is working as normal while
        Stripe retries.{" "}
        <Link href="/app/membership" className="underline">
          Update your card
        </Link>
        .
      </Notice>
    );
  }

  if (entitlement.lapsed?.status === "unpaid") {
    return (
      <Notice tone="danger">
        Your membership stopped because the payment could not be taken.
        Planning still works.{" "}
        <Link href="/app/membership" className="underline">
          Start it again
        </Link>
        .
      </Notice>
    );
  }

  return null;
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "danger";
  children: React.ReactNode;
}) {
  const look =
    tone === "warn"
      ? "border-warn/40 bg-warn/10 text-warn"
      : "border-danger/40 bg-danger/10 text-danger";
  return (
    <div className={`border-b ${look}`}>
      <p className="mx-auto w-full max-w-4xl px-4 py-2.5 text-sm sm:px-6">
        {children}
      </p>
    </div>
  );
}

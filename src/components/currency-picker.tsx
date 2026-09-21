"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CURRENCY_COOKIE, CURRENCY_OPTIONS } from "@/lib/billing/currencies";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Lets someone say where they are, when we guessed wrong or did not guess.
 *
 * The cookie is written here in the browser rather than through a route,
 * because it is a display preference and nothing more. There is no server
 * check to skip: the page validates the value when it reads it, and a cookie
 * naming a currency we do not quote is already ignored rather than trusted.
 * Making this httpOnly would buy nothing and cost a route.
 *
 * `router.refresh()` rather than a reload, so the server re-renders with the
 * new cookie and the page does not flash.
 */
export function CurrencyPicker({ current }: { current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Show prices in</span>
      <select
        value={current}
        disabled={pending}
        onChange={(event) => {
          document.cookie =
            `${CURRENCY_COOKIE}=${event.target.value}; path=/; ` +
            `max-age=${ONE_YEAR}; samesite=lax`;
          startTransition(() => router.refresh());
        }}
        className="rounded-control border border-border bg-bg px-2.5 py-1.5 text-sm font-medium text-fg outline-none focus:border-accent disabled:opacity-60"
      >
        {CURRENCY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

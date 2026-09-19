"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/trips", label: "My Trips" },
  { href: "/app/inspiration", label: "Inspiration" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-fg text-bg"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

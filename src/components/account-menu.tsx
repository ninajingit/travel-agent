"use client";

import { UserButton } from "@clerk/nextjs";

// The avatar menu. Clerk renders account and sign-out; we add the link to
// agent settings so it sits with the rest of "me" rather than in the nav.
// Client component because UserButton only accepts custom children there.
export function AccountMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Agent settings"
          href="/app/settings"
          labelIcon={<SettingsIcon />}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  );
}

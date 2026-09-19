"use client";

import { UserButton } from "@clerk/nextjs";

// The avatar menu. Clerk renders account and sign-out; we add the link to
// agent settings and pricing so they sit with the rest of "me" rather than
// in the nav.
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
        <UserButton.Link label="Pricing" href="/pricing" labelIcon={<TagIcon />} />
      </UserButton.MenuItems>
    </UserButton>
  );
}

function TagIcon() {
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
      <path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
    </svg>
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

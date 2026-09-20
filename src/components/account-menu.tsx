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
          labelIcon={<RobotIcon />}
        />
        <UserButton.Link
          label="Membership"
          href="/app/membership"
          labelIcon={<CardIcon />}
        />
        <UserButton.Link label="Pricing" href="/pricing" labelIcon={<TagIcon />} />
      </UserButton.MenuItems>
    </UserButton>
  );
}

function CardIcon() {
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
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" />
      <path d="M1.5 6.5h13M4 10h3" />
    </svg>
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

function RobotIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="5.5" width="11" height="8" rx="2" />
      <path d="M8 5.5V3M6.5 2.5h3" />
      <circle cx="6" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M6.5 11.75h3" />
    </svg>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The handful of building blocks every screen uses. Kept deliberately small:
// a card, a button, a field, a pill, a page header, an empty state.

export function Card({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={`rounded-card border border-border bg-surface ${className}`}
    />
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonLook: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:brightness-105 active:brightness-95",
  secondary:
    "border border-border bg-surface text-fg hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`${buttonBase} ${buttonLook[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      {...props}
      className={`${buttonBase} ${buttonLook[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  className = "",
  ...input
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium text-muted">{label}</span>
      <input
        {...input}
        className="mt-1.5 w-full rounded-control border border-border bg-bg px-3.5 py-2.5 text-base text-fg outline-none placeholder:text-muted/60 focus:border-accent"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

type PillTone = "neutral" | "accent" | "violet" | "warn" | "danger";

const pillLook: Record<PillTone, string> = {
  neutral: "border border-border text-muted",
  accent: "bg-accent text-accent-fg",
  violet: "bg-violet text-violet-fg",
  warn: "border border-warn text-warn",
  danger: "border border-danger text-danger",
};

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${pillLook[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  intro,
  aside,
}: {
  title: ReactNode;
  intro?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {intro && <p className="mt-2 max-w-xl text-muted">{intro}</p>}
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border p-8 text-center text-muted">
      {children}
    </div>
  );
}

export function ErrorText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-sm text-danger ${className}`}>{children}</p>;
}

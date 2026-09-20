import Link from "next/link";

// The logo: the product name with the company underneath, small.
export function Wordmark({ href, size = "md" }: { href: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className="flex flex-col leading-none">
      <span
        className={`font-display font-bold tracking-tight ${size === "lg" ? "text-xl" : "text-lg"}`}
      >
        Nomi
      </span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
        by Llama Inc.
      </span>
    </Link>
  );
}

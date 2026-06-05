import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

const baseClass =
  "group relative inline-flex items-center justify-center gap-2 rounded-full glass-strong px-7 py-3.5 " +
  "text-base font-medium text-foreground shadow-[0_8px_40px_-8px_rgba(99,102,241,0.6)] " +
  "transition-all duration-200 hover:scale-[1.03] hover:bg-white/15 active:scale-100 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-glow/70";

/** Subtle gradient sheen sitting inside the glass. */
function Sheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-cyan-glow/20 via-transparent to-violet-glow/20 opacity-70 transition-opacity group-hover:opacity-100"
    />
  );
}

/** Glassmorphism CTA. Renders as a Next <Link> when `href` is provided. */
export function GlassLinkButton({
  href,
  children,
  className = "",
  ...rest
}: BaseProps & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={`${baseClass} ${className}`} {...rest}>
      <Sheen />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

export default function GlassButton({
  children,
  className = "",
  ...rest
}: BaseProps & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button className={`${baseClass} ${className}`} {...rest}>
      <Sheen />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

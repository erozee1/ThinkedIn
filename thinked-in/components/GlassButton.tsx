import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

// Primary CTA — LinkedIn-blue gradient pill.
const baseClass =
  "group relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-blue px-7 py-3.5 " +
  "text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(10,102,194,0.65)] " +
  "transition-all duration-200 hover:scale-[1.03] hover:brightness-105 active:scale-100 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2]/40";

/** Primary CTA. Renders as a Next <Link> when `href` is provided. */
export function GlassLinkButton({
  href,
  children,
  className = "",
  ...rest
}: BaseProps & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={`${baseClass} ${className}`} {...rest}>
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
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

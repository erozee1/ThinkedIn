"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import logo from "@/public/thinkedinBACK.png";

const NAV = [
  { label: "The Proof", href: "/proof" },
  { label: "Self-Learning Layer", href: "/self-learning-layer" },
  { label: "Pricing", href: "/pricing" },
];

export default function SiteMast() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 flex h-[72px] items-center justify-between border-b border-black/10 bg-white/80 px-6 shadow-sm backdrop-blur-md sm:px-8">
        {/* Logo */}
        <Link href="/" aria-label="thinkedin — home" onClick={() => setOpen(false)}>
          <Image
            src={logo}
            alt="thinkedin"
            priority
            className="h-9 w-auto -translate-y-0.5 transition-transform hover:scale-[1.03] active:scale-95 sm:h-11"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004182] active:scale-95"
              >
                Dashboard
              </Link>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }} />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004182] active:scale-95"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex items-center justify-center rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile dropdown */}
      {open && (
        <div className="fixed inset-x-0 top-[72px] z-40 border-b border-black/10 bg-white shadow-lg md:hidden">
          <nav className="flex flex-col px-4 py-3">
            {NAV.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="my-2 border-t border-zinc-100" />
            {isSignedIn ? (
              <div className="flex items-center gap-3 px-3 py-2">
                <UserButton appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }} />
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-[#0a66c2]"
                >
                  Go to Dashboard →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1 pb-2">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="mx-1 rounded-full bg-[#0a66c2] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#004182]"
                >
                  Get started
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

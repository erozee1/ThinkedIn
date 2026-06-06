import Image from "next/image";
import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import { SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import logo from "@/public/thinkedinBACK.png";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@thinkedin.ai";

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const refundMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Refund request")}&body=${encodeURIComponent(
    "Hi,\n\nI'd like a refund for my thinkedin subscription.\n\nNo questions asked.\n",
  )}`;

  return (
    <div className="min-h-screen bg-white">
      {/* Masthead */}
      <header className="relative flex items-center justify-between px-6 py-4 sm:px-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[80px] border-b border-black/10 bg-white shadow-sm"
        />
        <Link href="/dashboard" className="relative">
          <Image
            src={logo}
            alt="thinkedin"
            priority
            className="h-10 w-auto -translate-y-1 sm:h-12"
          />
        </Link>
        <Link
          href="/dashboard"
          className="relative text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← Back to dashboard
        </Link>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <div className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Account
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Billing & Subscription
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Manage your plan, payment method, and invoices.
          </p>
        </div>

        {/* Current subscription management */}
        <div className="mb-8 rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Current plan
          </p>
          <SubscriptionDetailsButton>
            <button className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98]">
              View subscription details
            </button>
          </SubscriptionDetailsButton>
        </div>

        <div className="mb-8 rounded-xl border border-[#0a66c2]/12 bg-[#0a66c2]/[0.03] px-5 py-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#0a66c2]">
            Refunds
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            No questions asked money back
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            If you want a refund, email us and we&apos;ll sort it out. No back and
            forth.
          </p>
          <a
            href={refundMailto}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004182] active:scale-[0.98]"
          >
            Email for a refund
          </a>
        </div>

        {/* Change plan */}
        <div className="mb-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Change plan
          </p>
          <PricingTable />
        </div>
      </div>
    </div>
  );
}

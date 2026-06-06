"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { useAuth } from "@clerk/nextjs";
import { Check } from "lucide-react";

// ─── Replace these with the plan IDs from your Clerk Dashboard ───────────────
// Dashboard → Configure → Billing → Plans → click a plan → copy its ID
const PLAN_IDS = {
  pro: {
    monthly: "YOUR_PRO_MONTHLY_PLAN_ID",
    annual: "YOUR_PRO_ANNUAL_PLAN_ID",
  },
};
// ─────────────────────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  "50 network queries / month",
  "LinkedIn CSV import",
  "Basic search",
  "Profile cards",
];

const PRO_FEATURES = [
  "Unlimited queries",
  "LinkedIn CSV import",
  "Advanced search & filters",
  "AI-powered insights",
  "Priority support",
  "Early access to new features",
];

export default function PricingCards() {
  const [annual, setAnnual] = useState(false);
  const { isSignedIn } = useAuth();

  const planId = annual ? PLAN_IDS.pro.annual : PLAN_IDS.pro.monthly;
  const planPeriod = annual ? "annual" : "month";

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Billing toggle */}
      <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 p-1">
        <button
          onClick={() => setAnnual(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !annual
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setAnnual(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            annual
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Annual
          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
            2 months free
          </span>
        </button>
      </div>

      {/* Cards */}
      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">

        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Free</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-zinc-900">£0</span>
            <span className="mb-1 text-sm text-zinc-400">/ month</span>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Everything you need to get started.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="flex w-full items-center justify-center rounded-full border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="flex w-full items-center justify-center rounded-full border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
              >
                Get started free
              </Link>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border-2 border-[#0a66c2] bg-white p-8 shadow-lg shadow-[#0a66c2]/10">
          {/* Popular badge */}
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0a66c2] px-3 py-0.5 text-xs font-semibold text-white">
            Most popular
          </span>

          <p className="text-xs font-semibold uppercase tracking-widest text-[#0a66c2]">Pro</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-zinc-900">
              {annual ? "£8" : "£10"}
            </span>
            <span className="mb-1 text-sm text-zinc-400">/ month</span>
          </div>
          {annual && (
            <p className="mt-0.5 text-xs text-emerald-600 font-medium">£96 billed annually — save £24</p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            For power users and professionals.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0a66c2]" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <CheckoutButton planId={planId} planPeriod={planPeriod}>
              <button className="flex w-full items-center justify-center rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#004182] active:scale-[0.98]">
                {isSignedIn ? "Upgrade to Pro" : "Start Pro"}
              </button>
            </CheckoutButton>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-zinc-400">
        Prices in GBP. Cancel anytime.{" "}
        <Link href="/billing" className="underline hover:text-zinc-600">
          Manage your plan
        </Link>
      </p>
    </div>
  );
}

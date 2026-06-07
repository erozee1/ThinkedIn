"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { Check, Building2, X, Plus, Loader2 } from "lucide-react";

const PREMIUM_PLAN_ID = "cplan_3ElOjTTweSqk43p5PC1fiJFSd2W";

const FREE_FEATURES = [
  "50 network queries / month",
  "LinkedIn CSV import",
  "Basic search",
  "Profile cards",
];

const PREMIUM_FEATURES = [
  "Unlimited queries",
  "LinkedIn CSV import",
  "Advanced search & filters",
  "AI-powered insights",
  "Priority support",
  "Early access to new features",
];

const ENTERPRISE_FEATURES = [
  "Everything in Premium",
  "Up to 10 seats",
  "Shared network intelligence",
  "Team workspace & collaboration",
  "Admin controls & permissions",
  "Dedicated onboarding",
];

export default function PricingCards() {
  const [annual, setAnnual] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const { isSignedIn, has } = useAuth();

  const hasPremium = isSignedIn && has?.({ plan: "premium" });
  const planPeriod = annual ? "annual" : "month";

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Billing toggle */}
      <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 p-1">
        <button
          onClick={() => setAnnual(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !annual ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setAnnual(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            annual ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Annual
          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
            2 months free
          </span>
        </button>
      </div>

      {/* Cards */}
      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-3">

        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Free</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-zinc-900">£0</span>
            <span className="mb-1 text-sm text-zinc-400">/ month</span>
          </div>
          <p className="mt-2 text-sm text-zinc-500">Everything you need to get started.</p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            {hasPremium ? (
              <p className="flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-zinc-400">
                <Check className="h-4 w-4" />
                Included in your plan
              </p>
            ) : isSignedIn ? (
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

        {/* Premium */}
        <div className="relative flex flex-col rounded-2xl border-2 border-[#0a66c2] bg-white p-8 shadow-lg shadow-[#0a66c2]/10">
          <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white ${hasPremium ? "bg-emerald-500" : "bg-[#0a66c2]"}`}>
            {hasPremium ? "Your current plan" : "Most popular"}
          </span>

          <p className="text-xs font-semibold uppercase tracking-widest text-[#0a66c2]">Premium</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-zinc-900">
              {annual ? "£8" : "£10"}
            </span>
            <span className="mb-1 text-sm text-zinc-400">/ month</span>
          </div>
          {annual && (
            <p className="mt-0.5 text-xs font-medium text-emerald-600">£96 billed annually — save £24</p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            For power users and professionals. Refund anytime, no questions asked.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0a66c2]" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            {hasPremium ? (
              <div className="flex w-full flex-col items-center gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <Check className="h-4 w-4" />
                  You&apos;re on Premium
                </p>
                <Link href="/billing" className="text-xs text-zinc-400 underline-offset-2 hover:underline">
                  Manage subscription
                </Link>
              </div>
            ) : isSignedIn ? (
              <CheckoutButton planId={PREMIUM_PLAN_ID} planPeriod={planPeriod}>
                <button className="flex w-full items-center justify-center rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#004182] active:scale-[0.98]">
                  Upgrade to Premium
                </button>
              </CheckoutButton>
            ) : (
              <Link
                href="/sign-up?redirect_url=/pricing"
                className="flex w-full items-center justify-center rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#004182] active:scale-[0.98]"
              >
                Start Premium
              </Link>
            )}
          </div>
        </div>

        {/* Enterprise */}
        <div className="flex flex-col rounded-2xl border border-zinc-200 bg-zinc-900 p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Enterprise</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-white">Custom</span>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            For teams that want to unlock their collective network.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {ENTERPRISE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            {isSignedIn ? (
              <button
                onClick={() => setShowOrgModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.98]"
              >
                <Building2 className="h-4 w-4" />
                Create organisation
              </button>
            ) : (
              <Link
                href="/sign-up?redirect_url=/pricing"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.98]"
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-zinc-400">
        Prices in GBP. Cancel anytime.{" "}
        <Link href="/billing" className="underline hover:text-zinc-600">
          Manage your plan
        </Link>
      </p>

      {showOrgModal && <OrgCreationModal onClose={() => setShowOrgModal(false)} />}
    </div>
  );
}

/* ── Organisation creation modal ─────────────────────────────────────────── */

function OrgCreationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { createOrganization } = useOrganizationList();
  const [step, setStep] = useState<"name" | "invite" | "done">("name");
  const [orgName, setOrgName] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<Awaited<ReturnType<NonNullable<typeof createOrganization>>> | null>(null);

  const handleCreate = async () => {
    if (!orgName.trim() || !createOrganization) return;
    setLoading(true);
    setError("");
    try {
      const created = await createOrganization({ name: orgName.trim() });
      setOrg(created);
      setStep("invite");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create organisation");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!org) return;
    setLoading(true);
    setError("");
    const validEmails = emails.map((e) => e.trim()).filter(Boolean);
    try {
      await Promise.all(
        validEmails.map((emailAddress) =>
          org.inviteMember({ emailAddress, role: "org:member" }),
        ),
      );
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Some invites failed — check the email addresses");
    } finally {
      setLoading(false);
    }
  };

  const addEmailField = () => setEmails((prev) => [...prev, ""]);
  const updateEmail = (i: number, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? val : e)));
  const removeEmail = (i: number) =>
    setEmails((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="h-4 w-4" />
        </button>

        {step === "name" && (
          <>
            <Building2 className="mb-4 h-8 w-8 text-zinc-800" />
            <h2 className="text-xl font-semibold text-zinc-900">Create your organisation</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Your team will share a workspace and can pool their networks.
            </p>
            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Organisation name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Acme Corp"
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20"
                autoFocus
              />
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={!orgName.trim() || loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create organisation"}
            </button>
          </>
        )}

        {step === "invite" && (
          <>
            <h2 className="text-xl font-semibold text-zinc-900">Invite your team</h2>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">{orgName}</span> is ready. Invite members or skip for now.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {emails.map((email, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(i, e.target.value)}
                    placeholder="teammate@company.com"
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20"
                  />
                  {emails.length > 1 && (
                    <button
                      onClick={() => removeEmail(i)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addEmailField}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setStep("done"); }}
                className="flex-1 rounded-full border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Skip for now
              </button>
              <button
                onClick={handleInvite}
                disabled={loading || emails.every((e) => !e.trim())}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invites"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">You&apos;re all set</h2>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">{orgName}</span> is live. Head to your dashboard to start exploring your team&apos;s network.
            </p>
            <button
              onClick={() => { onClose(); router.push("/dashboard"); }}
              className="mt-6 flex w-full items-center justify-center rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.98]"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

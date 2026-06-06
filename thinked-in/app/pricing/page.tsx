import SiteMast from "@/components/SiteMast";
import PricingCards from "@/components/PricingCards";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteMast />

      <div className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Pricing
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Talk to your network
          </h1>
          <p className="mt-3 text-base text-zinc-500">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <PricingCards />
      </div>
    </div>
  );
}

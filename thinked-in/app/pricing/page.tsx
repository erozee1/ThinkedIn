import Image from "next/image";
import Link from "next/link";
import logo from "@/public/thinkedinBACK.png";
import PricingCards from "@/components/PricingCards";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Masthead */}
      <header className="relative flex items-center px-6 py-4 sm:px-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[80px] border-b border-black/10 bg-white shadow-sm"
        />
        <Link href="/" className="relative">
          <Image
            src={logo}
            alt="thinkedin"
            priority
            className="h-10 w-auto -translate-y-1 sm:h-12"
          />
        </Link>
      </header>

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

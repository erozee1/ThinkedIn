"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GetStartedBubble from "./GetStartedBubble";
import ChatDemo from "./ChatDemo";

// Landing content. Fades out over the (shared, static) aurora background while
// the sign-in page fades its card in — so the background never changes color
// across the navigation.
export default function LandingHero() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    // Let the bubble pop + content fade play, then navigate.
    setTimeout(() => router.push("/sign-in"), 480);
  };

  return (
    <motion.div
      className="relative z-10 flex min-h-dvh flex-col"
      animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 0.985 : 1 }}
      transition={{ duration: 0.42, ease: "easeInOut" }}
    >
      {/* Brand — top, on a solid white masthead */}
      <header className="relative flex items-center justify-center px-6 py-6">
        {/* solid white masthead bar */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[68px] border-b border-black/10 bg-white shadow-sm"
        />
        {/* TODO: replace wordmark with the real PNG logo when provided. */}
        <span className="relative text-xl font-semibold tracking-tight text-gradient">
          thinkedin
        </span>
      </header>

      {/* Headline → CTA → live chat showcase */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pb-16 pt-4 text-center">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_10px_rgba(12,74,140,0.4)] sm:text-5xl">
          Talk to your network
          <br />
          <span className="text-white/80">in one prompt</span>
        </h1>

        <GetStartedBubble onStart={start} />

        <div className="mt-12 w-full">
          <ChatDemo />
        </div>
      </div>
    </motion.div>
  );
}

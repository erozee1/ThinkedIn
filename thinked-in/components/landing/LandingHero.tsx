"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GetStartedBubble from "./GetStartedBubble";
import MockChatWindow from "./MockChatWindow";

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
      className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pb-16 pt-10 text-center lg:max-w-5xl xl:max-w-6xl"
      animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 0.985 : 1 }}
      transition={{ duration: 0.42, ease: "easeInOut" }}
    >
      <h1 className="font-serif-ui text-balance text-4xl font-semibold leading-tight tracking-tight text-[#0b2340] sm:text-5xl lg:whitespace-nowrap xl:text-6xl">
        Talk to your network{" "}
        <br className="lg:hidden" />
        <span className="text-[#0b2340]/70">in one prompt</span>
      </h1>

      {/* Desktop-only one-liner (mobile stays as-is) */}
      <p className="font-serif-ui mt-4 hidden text-balance text-lg font-normal text-[#1a4070]/75 md:block">
        Find out what your bubble can provide today.
      </p>

      <GetStartedBubble onStart={start} />

      <div className="mt-14 w-full">
        <MockChatWindow />
      </div>
    </motion.div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import logo from "@/public/thinkedinBACK.png";
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
      className="relative z-10 flex min-h-dvh flex-col"
      animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 0.985 : 1 }}
      transition={{ duration: 0.42, ease: "easeInOut" }}
    >
      {/* Brand — top-left, on a solid white masthead */}
      <header className="relative flex items-center px-6 py-6 sm:px-8">
        {/* slightly translucent masthead bar */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[68px] border-b border-black/10 bg-white/80 shadow-sm backdrop-blur-md"
        />
        <Image
          src={logo}
          alt="thinkedin"
          priority
          className="relative h-7 w-auto sm:h-8"
        />
      </header>

      {/* Headline → CTA → live chat showcase */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pb-16 pt-4 text-center lg:max-w-5xl xl:max-w-6xl">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_10px_rgba(12,74,140,0.4)] sm:text-5xl lg:whitespace-nowrap xl:text-6xl">
          Talk to your network{" "}
          <br className="lg:hidden" />
          <span className="text-white/80">in one prompt</span>
        </h1>

        {/* Desktop-only one-liner (mobile stays as-is) */}
        <p className="mt-4 hidden text-balance text-lg text-white/85 drop-shadow-[0_1px_8px_rgba(12,74,140,0.35)] md:block">
          Find out what your bubble can provide today.
        </p>

        <GetStartedBubble onStart={start} />

        <div className="mt-14 w-full">
          <MockChatWindow />
        </div>
      </div>
    </motion.div>
  );
}

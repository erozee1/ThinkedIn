"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Glass "Get started" button: a solid blue base with an iridescent glass sheen
// + glossy highlight clipped to the same rounded shape, so the glass fits the
// button exactly. On click it cleanly fades/scales out while LandingHero
// crossfades into the sign-in page.
export default function GetStartedBubble({ onStart }: { onStart: () => void }) {
  const [popped, setPopped] = useState(false);

  const handleClick = () => {
    if (popped) return;
    setPopped(true);
    onStart();
  };

  return (
    <div className="relative mt-8 inline-flex">
      <AnimatePresence>
        {!popped && (
          <motion.button
            onClick={handleClick}
            aria-label="Get started"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-blue px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_-10px_rgba(10,102,194,0.7)] ring-1 ring-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Iridescent shimmer — clipped to the pill so it hugs the button */}
            <span
              aria-hidden
              className="iridescent-sheen pointer-events-none absolute left-1/2 top-1/2 h-[300%] w-[300%] opacity-25 mix-blend-screen"
            />
            {/* Glossy top reflection */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-full bg-gradient-to-b from-white/55 to-transparent"
            />
            <span className="relative z-10 inline-flex items-center gap-2">
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

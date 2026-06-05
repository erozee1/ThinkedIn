"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// "Get started" styled as a sent chat bubble (matches the user/sender bubbles in
// the demo). On click it cleanly fades out while LandingHero crossfades into
// the sign-in page.
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
            className="group inline-flex items-center gap-2 rounded-2xl rounded-br-md bg-gradient-blue px-6 py-3 text-base font-semibold text-white shadow-md ring-1 ring-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            Get started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

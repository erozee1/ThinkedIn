"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// "Get started" as a bubble that pops on click, then plays an iris transition
// into the sign-in page.
export default function GetStartedBubble() {
  const router = useRouter();
  const [popped, setPopped] = useState(false);

  const handleClick = () => {
    if (popped) return;
    setPopped(true);
    // Navigate once the iris overlay has covered the screen.
    setTimeout(() => router.push("/sign-in"), 640);
  };

  return (
    <>
      <div className="relative mt-8 inline-flex">
        <AnimatePresence>
          {!popped && (
            <motion.button
              onClick={handleClick}
              aria-label="Get started"
              className="group relative inline-flex items-center justify-center gap-2 rounded-full glass-strong px-7 py-3.5 text-base font-medium text-foreground shadow-[0_8px_40px_-10px_rgba(99,102,241,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-glow/60"
              initial={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Bubble-pop ring */}
        <AnimatePresence>
          {popped && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-indigo-300/60"
              initial={{ scale: 1, opacity: 0.85 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Iris overlay expanding to cover the page before navigation */}
      <AnimatePresence>
        {popped && (
          <motion.div
            className="fixed inset-0 z-50 bg-navy-950"
            aria-hidden
            initial={{ clipPath: "circle(0% at 50% 42%)" }}
            animate={{ clipPath: "circle(150% at 50% 42%)" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

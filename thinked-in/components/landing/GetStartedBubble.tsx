"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Deterministic droplet spray (no Math.random → no hydration issues).
const DROPLETS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const dist = 60 + (i % 3) * 18;
  return {
    id: i,
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    size: 7 + (i % 4) * 2,
  };
});

// "Get started" as a glossy bubble that pops into droplets + a ripple on click,
// then plays an iris transition into the sign-in page.
export default function GetStartedBubble() {
  const router = useRouter();
  const [popped, setPopped] = useState(false);

  const handleClick = () => {
    if (popped) return;
    setPopped(true);
    setTimeout(() => router.push("/sign-in"), 720);
  };

  return (
    <>
      <div className="relative mt-8 inline-flex items-center justify-center">
        {/* Ripple shockwave */}
        <AnimatePresence>
          {popped && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0a66c2]/60"
              initial={{ scale: 0.4, opacity: 0.8 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Droplet spray */}
        {popped &&
          DROPLETS.map((d) => (
            <motion.span
              key={d.id}
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-gradient-blue"
              style={{ width: d.size, height: d.size }}
              initial={{ x: -d.size / 2, y: -d.size / 2, opacity: 0, scale: 0.4 }}
              animate={{
                x: d.x - d.size / 2,
                y: d.y - d.size / 2 + 16,
                opacity: [0, 1, 0],
                scale: [0.4, 1, 0.5],
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          ))}

        <AnimatePresence>
          {!popped && (
            <motion.button
              onClick={handleClick}
              aria-label="Get started"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-blue px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_30px_-8px_rgba(10,102,194,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2]/40"
              initial={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              exit={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {/* Glossy bubble highlight */}
              <span
                aria-hidden
                className="pointer-events-none absolute -left-2 -top-3 h-10 w-16 rounded-full bg-white/35 blur-md"
              />
              <span className="relative z-10 inline-flex items-center gap-2">
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Iris overlay expanding to cover the page before navigation */}
      <AnimatePresence>
        {popped && (
          <motion.div
            className="fixed inset-0 z-50 bg-gradient-blue"
            aria-hidden
            initial={{ clipPath: "circle(0% at 50% 42%)" }}
            animate={{ clipPath: "circle(150% at 50% 42%)" }}
            transition={{ duration: 0.55, ease: "easeInOut", delay: 0.15 }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

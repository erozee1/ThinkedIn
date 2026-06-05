"use client";

import { motion } from "framer-motion";

/** AI "thinking" indicator — three pulsing dots inside a glass bubble. */
export default function ThinkingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl glass px-4 py-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-2 w-2 rounded-full bg-gradient-to-br from-cyan-glow to-indigo-glow"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.16,
          }}
        />
      ))}
    </div>
  );
}

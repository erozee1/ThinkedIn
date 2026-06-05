"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { landingDemoPeople } from "@/lib/mock-data";
import ProfileCard from "@/components/ProfileCard";
import ThinkingDots from "@/components/ThinkingDots";

// Looping fake conversation that lives (blurred) behind the landing hero.
// Phases: 0 user message → 1 thinking → 2 response + cards → reset → loop.
const PHASE_TIMINGS = [1300, 1700, 4800]; // ms spent in phases 0, 1, 2

export default function ChatDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase((p) => (p + 1) % 3);
    }, PHASE_TIMINGS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6">
      {/* User message — right side */}
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
      >
        <div className="max-w-[78%] rounded-3xl rounded-br-lg bg-gradient-to-br from-indigo-glow/90 to-violet-glow/80 px-5 py-3 text-[15px] font-medium text-white shadow-lg">
          i want a tech internship NOW
        </div>
      </motion.div>

      {/* AI side — left */}
      <div className="flex flex-col items-start gap-3">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ThinkingDots label="thinkedin is searching your network" />
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="answer"
              className="flex w-full flex-col gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="max-w-[80%] rounded-3xl rounded-bl-lg glass-strong px-5 py-3 text-[15px] text-foreground">
                here&apos;s a couple useful guys 👇
              </div>
              <div className="flex w-full flex-col gap-2">
                {landingDemoPeople.map((person, i) => (
                  <motion.div
                    key={person.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.35, type: "spring", stiffness: 200, damping: 22 }}
                  >
                    <ProfileCard person={person} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

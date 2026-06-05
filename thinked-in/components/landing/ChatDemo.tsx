"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { landingCofounders, landingDemoPeople } from "@/lib/mock-data";
import type { ProfileCardData } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import ThinkingDots from "@/components/ThinkingDots";

// Looping fake conversations behind the landing hero.
// Phases per conversation: 0 question → 1 thinking → 2 answer + cards,
// then advance to the next conversation and loop.
const CONVERSATIONS: { q: string; a: string; people: ProfileCardData[] }[] = [
  {
    q: "i want a tech internship NOW",
    a: "here's a couple useful guys 👇",
    people: landingDemoPeople,
  },
  {
    q: "find me 3 cracked cofounders my age",
    a: "say less — 3 cracked cofounders 👇",
    people: landingCofounders,
  },
];

const PHASE_TIMINGS = [1300, 1700, 4800]; // ms in phases 0, 1, 2

export default function ChatDemo() {
  const [phase, setPhase] = useState(0);
  const [conv, setConv] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (phase === 2) {
        setConv((c) => (c + 1) % CONVERSATIONS.length);
        setPhase(0);
      } else {
        setPhase(phase + 1);
      }
    }, PHASE_TIMINGS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  const current = CONVERSATIONS[conv];

  return (
    <div className="mx-auto flex min-h-[320px] w-full max-w-md flex-col gap-3 px-4">
      {/* User message — right side. Keyed by conv so it re-animates on switch. */}
      <div className="flex justify-end">
        <AnimatePresence mode="wait">
          <motion.div
            key={conv}
            className="max-w-[82%] rounded-2xl rounded-br-md bg-gradient-blue px-4 py-2.5 text-sm font-medium text-white shadow-md ring-1 ring-white/40"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            {current.q}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* AI side — left */}
      <div className="flex flex-col items-start gap-3">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key={`thinking-${conv}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ThinkingDots label="thinkedin is searching your network" />
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key={`answer-${conv}`}
              className="flex w-full flex-col gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="max-w-[82%] rounded-2xl rounded-bl-md glass px-4 py-2.5 text-sm text-foreground">
                {current.a}
              </div>
              <div className="flex w-full flex-col gap-2">
                {current.people.map((person, i) => (
                  <motion.div
                    key={person.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.3, type: "spring", stiffness: 200, damping: 22 }}
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

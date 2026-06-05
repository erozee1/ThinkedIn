"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import ChatDemo from "./ChatDemo";

// The demo conversation inside a glassy, 3D-tilted chat window with a very
// slight mouse parallax. Flat (no tilt/parallax) on mobile.
export default function MockChatWindow() {
  const offX = useMotionValue(0); // deg added to rotateY (horizontal mouse)
  const offY = useMotionValue(0); // deg added to rotateX (vertical mouse)
  const sX = useSpring(offX, { stiffness: 70, damping: 18 });
  const sY = useSpring(offY, { stiffness: 70, damping: 18 });
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, rz: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () =>
      setTilt(mq.matches ? { rx: 13, ry: -13, rz: 1.5 } : { rx: 0, ry: 0, rz: 0 });
    apply();
    mq.addEventListener("change", apply);

    const onMove = (e: MouseEvent) => {
      if (!mq.matches) {
        offX.set(0);
        offY.set(0);
        return;
      }
      const nx = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
      const ny = e.clientY / window.innerHeight - 0.5;
      offX.set(nx * 4); // very slight
      offY.set(ny * -4);
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("mousemove", onMove);
    };
  }, [offX, offY]);

  const rotateX = useTransform(sY, (v) => tilt.rx + v);
  const rotateY = useTransform(sX, (v) => tilt.ry + v);
  const transform = useMotionTemplate`perspective(1600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${tilt.rz}deg)`;

  return (
    <div className="mx-auto w-full max-w-lg">
      <motion.div style={{ transform }} className="will-change-transform">
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 shadow-[0_40px_90px_-25px_rgba(12,74,140,0.55)] backdrop-blur-xl">
          {/* Title bar — pure white, macOS traffic lights on the left */}
          <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold leading-tight text-foreground">
                Your network
              </p>
              <p className="flex items-center gap-1 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                312 connections · online
              </p>
            </div>
          </div>

          {/* Conversation */}
          <div className="px-2 py-6">
            <ChatDemo />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

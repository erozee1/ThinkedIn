"use client";

import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import BackgroundFX from "@/components/BackgroundFX";
import SiteMast from "@/components/SiteMast";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <BackgroundFX />
      <SiteMast />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <SignIn
            fallbackRedirectUrl="/dashboard"
            forceRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            signUpForceRedirectUrl="/dashboard"
          />
        </motion.div>
      </div>
    </main>
  );
}

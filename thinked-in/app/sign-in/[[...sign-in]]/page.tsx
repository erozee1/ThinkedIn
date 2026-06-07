"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BackgroundFX from "@/components/BackgroundFX";
import SiteMast from "@/components/SiteMast";

export default function SignInPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace("/dashboard");
  }, [isSignedIn, router]);

  if (isSignedIn) return null;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <BackgroundFX variant="landing" />
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

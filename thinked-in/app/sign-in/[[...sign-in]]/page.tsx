"use client";

import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import BackgroundFX from "@/components/BackgroundFX";
import SiteMast from "@/components/SiteMast";

export default function SignInPage() {
  const router = useRouter();

  // TEMPORARY dev bypass: set the cookie the proxy/API check for, then go in.
  const bypassLogin = () => {
    document.cookie = "tk_bypass=1; path=/; max-age=86400; samesite=lax";
    router.push("/dashboard");
  };

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
          <SignIn />

          <button
            onClick={bypassLogin}
            className="rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.03] hover:bg-[#004182] active:scale-95"
          >
            Bypass login (dev)
          </button>
        </motion.div>
      </div>
    </main>
  );
}

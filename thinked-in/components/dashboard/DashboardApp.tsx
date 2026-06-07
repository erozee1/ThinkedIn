"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import OnboardingFlow from "./OnboardingFlow";
import ChatApp from "./ChatApp";

const IMPORTED_KEY = "thinkedin:hasImported";

type Stage = "init" | "onboarding" | "chat";

// Top-level dashboard state machine. The SERVER (dashboard/page.tsx) decides the
// initial stage from the DB and passes it in, so a stale client cache can't strand
// a user in onboarding. We still re-check /api/status on mount as a backstop.
export default function DashboardApp({ initialStage = "init" as Stage }: { initialStage?: Stage }) {
  const [stage, setStage] = useState<Stage>(initialStage);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data?.hasConnections) {
          localStorage.setItem(IMPORTED_KEY, "true");
          setStage("chat");
        } else {
          setStage((s) => (s === "init" ? "onboarding" : s));
        }
      } catch {
        if (!cancelled) {
          const imported = localStorage.getItem(IMPORTED_KEY);
          setStage((s) => (s === "init" ? (imported === "true" ? "chat" : "onboarding") : s));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(IMPORTED_KEY, "true");
    setStage("chat");
  }, []);

  const handleReimport = useCallback(() => {
    localStorage.removeItem(IMPORTED_KEY);
    setStage("onboarding");
  }, []);

  if (stage === "init") {
    return (
      <main className="relative flex h-dvh items-center justify-center">
        <div className="aurora" aria-hidden />
        <Loader2 className="relative z-10 h-6 w-6 animate-spin text-muted" />
      </main>
    );
  }

  if (stage === "onboarding") {
    return <OnboardingFlow onComplete={handleComplete} />;
  }

  return <ChatApp onReimport={handleReimport} />;
}

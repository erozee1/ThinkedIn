"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import OnboardingFlow from "./OnboardingFlow";
import ChatApp from "./ChatApp";

const IMPORTED_KEY = "thinkedin:hasImported";

type Stage = "init" | "onboarding" | "chat";

// Read the one-time import flag from localStorage without an effect (avoids
// hydration mismatch + setState-in-effect). Server snapshot is "init" so the
// brief loader shows until the client resolves the real stage.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function getSnapshot(): Stage {
  return localStorage.getItem(IMPORTED_KEY) === "true" ? "chat" : "onboarding";
}
function getServerSnapshot(): Stage {
  return "init";
}

// Top-level dashboard state machine. Onboarding is one-time: a faked
// `hasImported` flag (localStorage) sends returning users straight to chat.
export default function DashboardApp() {
  const storedStage = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // In-session overrides for transitions (consent→chat, re-import→onboarding).
  const [override, setOverride] = useState<Stage | null>(null);
  const stage = override ?? storedStage;

  const handleComplete = useCallback(() => {
    localStorage.setItem(IMPORTED_KEY, "true");
    setOverride("chat");
  }, []);

  const handleReimport = useCallback(() => {
    localStorage.removeItem(IMPORTED_KEY);
    setOverride("onboarding");
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

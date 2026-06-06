"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import OnboardingFlow from "./OnboardingFlow";
import ChatApp from "./ChatApp";

const IMPORTED_KEY = "thinkedin:hasImported";

type Stage = "init" | "onboarding" | "chat";

type DashboardDebug = {
  userId: string;
  initialHasConnections: boolean;
};

// Top-level dashboard state machine. The SERVER (dashboard/page.tsx) decides the
// initial stage from the DB and passes it in, so a stale client cache can't strand
// a user in onboarding. We still re-check /api/status on mount as a backstop.
export default function DashboardApp({
  initialStage = "init" as Stage,
  debug,
}: {
  initialStage?: Stage;
  debug: DashboardDebug;
}) {
  const { isSignedIn, user } = useUser();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [localImported, setLocalImported] = useState<string | null>(null);
  const [statusDebug, setStatusDebug] = useState<{
    userId: string | null;
    hasConnections: boolean | null;
    error: string | null;
    httpStatus: number | null;
  }>({
    userId: null,
    hasConnections: null,
    error: null,
    httpStatus: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setStatusDebug({
          userId: typeof data?.userId === "string" ? data.userId : null,
          hasConnections: typeof data?.hasConnections === "boolean" ? data.hasConnections : null,
          error: typeof data?.error === "string" ? data.error : null,
          httpStatus: res.status,
        });
        if (data?.hasConnections) {
          localStorage.setItem(IMPORTED_KEY, "true");
          setLocalImported("true");
          setStage("chat");
        } else {
          localStorage.removeItem(IMPORTED_KEY);
          setLocalImported(null);
          setStage((s) => (s === "init" ? "onboarding" : s));
        }
      } catch {
        setStatusDebug({
          userId: null,
          hasConnections: null,
          error: "fetch_failed",
          httpStatus: null,
        });
        if (!cancelled) {
          const imported = localStorage.getItem(IMPORTED_KEY);
          setLocalImported(imported);
          setStage((s) => (s === "init" ? (imported === "true" ? "chat" : "onboarding") : s));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(IMPORTED_KEY, "true");
    setLocalImported("true");
    setStage("chat");
  }, []);

  const handleReimport = useCallback(() => {
    localStorage.removeItem(IMPORTED_KEY);
    setLocalImported(null);
    setStage("onboarding");
  }, []);

  const debugPanel = (
    <div className="fixed bottom-3 left-3 z-[80] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-black/10 bg-white/92 px-3 py-2 text-[11px] leading-relaxed text-zinc-700 shadow-lg backdrop-blur">
      <div className="font-semibold text-zinc-900">Dashboard debug</div>
      <div>stage: {stage}</div>
      <div>signed in: {String(Boolean(isSignedIn))}</div>
      <div>client user: {user?.id ?? "null"}</div>
      <div>server user: {debug.userId}</div>
      <div>server hasConnections: {String(debug.initialHasConnections)}</div>
      <div>status user: {statusDebug.userId ?? "null"}</div>
      <div>status hasConnections: {String(statusDebug.hasConnections)}</div>
      <div>status http: {statusDebug.httpStatus ?? "null"}</div>
      <div>status error: {statusDebug.error ?? "null"}</div>
      <div>local imported: {localImported ?? "null"}</div>
    </div>
  );

  if (stage === "init") {
    return (
      <main className="relative flex h-dvh items-center justify-center">
        <div className="aurora" aria-hidden />
        <Loader2 className="relative z-10 h-6 w-6 animate-spin text-muted" />
        {debugPanel}
      </main>
    );
  }

  if (stage === "onboarding") {
    return (
      <>
        <OnboardingFlow onComplete={handleComplete} />
        {debugPanel}
      </>
    );
  }

  return (
    <>
      <ChatApp onReimport={handleReimport} />
      {debugPanel}
    </>
  );
}

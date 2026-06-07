"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// Must match TOKEN_MESSAGE_SOURCE in the extension's lib/config.ts.
const TOKEN_MESSAGE_SOURCE = "thinkedin-extension";

type Status = "minting" | "done" | "error";

/**
 * Connect flow for the Chrome extension. The route is Clerk-protected, so by the
 * time this renders the user is signed in. We mint a long-lived token and post it
 * to the extension's content script via window.postMessage.
 */
export default function ExtensionConnectPage() {
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState<Status>("minting");

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/extension/token", { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        const { token } = (await res.json()) as { token: string };
        if (cancelled) return;
        window.postMessage({ source: TOKEN_MESSAGE_SOURCE, token }, window.location.origin);
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">thinkedin extension</h1>
        {status === "minting" && (
          <p className="mt-3 text-sm text-zinc-500">Connecting your account…</p>
        )}
        {status === "done" && (
          <>
            <p className="mt-3 text-sm text-emerald-600">
              ✓ Connected{user?.firstName ? `, ${user.firstName}` : ""}.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              You can close this tab — the extension is ready.
            </p>
          </>
        )}
        {status === "error" && (
          <p className="mt-3 text-sm text-red-600">
            Couldn&apos;t connect. Make sure you&apos;re signed in and try again.
          </p>
        )}
      </div>
    </div>
  );
}

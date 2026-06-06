"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Dashboard error
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          The dashboard crashed before it could render.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This is a temporary debug screen so we can see the actual production failure
          instead of a blank page.
        </p>

        <div className="mt-5 rounded-2xl bg-black/[0.04] p-4 text-sm text-foreground">
          <div>
            <span className="font-medium">Message:</span>{" "}
            {error.message || "Unknown error"}
          </div>
          <div className="mt-2">
            <span className="font-medium">Digest:</span>{" "}
            {error.digest ?? "none"}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-full bg-gradient-blue px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95"
          >
            Retry dashboard
          </button>
          <Link
            href="/"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-all hover:text-foreground active:scale-95"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

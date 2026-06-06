"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { enrichmentRoster } from "@/lib/mock-data";
import type { EnrichmentProgress } from "@/lib/types";
import GlassButton from "@/components/GlassButton";

const LINKEDIN_EXPORT_URL =
  "https://www.linkedin.com/mypreferences/d/download-my-data";

type Step = "import" | "consent" | "enriching" | "ready";

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("import");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState<{ jobId: string; total: number } | null>(null);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((file: File) => {
    fileRef.current = file;
    setFileName(file.name);
    setStep("consent");
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const startEnrichment = useCallback(async () => {
    setStep("enriching");
    const form = new FormData();
    if (fileRef.current) form.append("file", fileRef.current);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = (await res.json()) as { jobId: string; totalConnections: number };
    setJob({ jobId: data.jobId, total: data.totalConnections });
  }, []);

  // Poll enrichment progress once a job exists.
  useEffect(() => {
    if (step !== "enriching" || !job) return;
    let active = true;

    const tick = async () => {
      const res = await fetch(`/api/enrich?job_id=${encodeURIComponent(job.jobId)}`);
      if (!active) return;
      const data = (await res.json()) as EnrichmentProgress;
      setProgress(data);
      if (data.status === "complete") {
        setTimeout(() => active && setStep("ready"), 700);
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [step, job]);

  return (
    <main className="relative flex h-dvh w-full items-center justify-center overflow-hidden px-4">
      <div className="aurora" aria-hidden />

      <div className="relative z-10 w-full max-w-xl">
        <AnimatePresence mode="wait">
          {step === "import" && (
            <Stage key="import">
              <AssistantBubble>
                <p className="text-foreground">
                  Let&apos;s get your LinkedIn data. Request your export here:
                </p>
                <a
                  href={LINKEDIN_EXPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 break-all text-sm font-medium text-cyan-glow underline-offset-2 hover:underline"
                >
                  linkedin.com/mypreferences/d/download-my-data
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <p className="mt-2 text-sm text-muted">
                  It&apos;ll take up to 15 minutes to arrive. When it does, just drag
                  it in here.
                </p>
              </AssistantBubble>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                  dragging
                    ? "border-[#0a66c2] bg-[#0a66c2]/5"
                    : "border-border bg-surface hover:bg-black/[0.03]"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) acceptFile(file);
                  }}
                />
                <UploadCloud className="h-9 w-9 text-[#0a66c2]" />
                <div>
                  <p className="font-medium text-foreground">
                    Drop your LinkedIn export here
                  </p>
                  <p className="text-sm text-muted">
                    Connections.csv — or click to browse
                  </p>
                </div>
              </label>
            </Stage>
          )}

          {step === "consent" && (
            <Stage key="consent">
              <div className="rounded-3xl glass-strong p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a66c2]/10">
                    <ShieldCheck className="h-5 w-5 text-[#0a66c2]" />
                  </span>
                  <h2 className="text-lg font-semibold text-foreground">
                    Quick heads-up
                  </h2>
                </div>

                {fileName && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-sm text-muted">
                    <FileText className="h-4 w-4" />
                    {fileName}
                  </div>
                )}

                <p className="mt-4 text-sm leading-relaxed text-muted">
                  We&apos;ll be using{" "}
                  <span className="font-medium text-foreground">Connections.csv</span>{" "}
                  and{" "}
                  <span className="font-medium text-foreground">messages.csv</span>{" "}
                  from your export to build your private network. Everything will be{" "}
                  <span className="font-medium text-foreground">deleted afterwards</span>{" "}
                  — nothing is stored or shared.
                </p>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      fileRef.current = null;
                      setFileName(null);
                      setStep("import");
                    }}
                    className="rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-all hover:text-foreground active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startEnrichment}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-blue px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95"
                  >
                    I consent
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Stage>
          )}

          {(step === "enriching" || step === "ready") && (
            <Stage key="enriching">
              <EnrichmentPanel
                progress={progress}
                ready={step === "ready"}
                onLetsChat={onComplete}
              />
            </Stage>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Stage({ children, ...rest }: { children: React.ReactNode; key?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-blue">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <div className="rounded-3xl rounded-tl-lg glass-strong px-5 py-4">{children}</div>
    </div>
  );
}

function EnrichmentPanel({
  progress,
  ready,
  onLetsChat,
}: {
  progress: EnrichmentProgress | null;
  ready: boolean;
  onLetsChat: () => void;
}) {
  const total = progress?.total ?? 0;
  const enriched = progress?.enrichedCount ?? 0;
  const ratio = total ? enriched / total : 0;

  // Map real progress onto the roster so people "pop in" as it climbs.
  const revealed = Math.min(
    enrichmentRoster.length,
    Math.ceil(enrichmentRoster.length * ratio),
  );
  const people = enrichmentRoster.slice(0, revealed);

  return (
    <div className="rounded-3xl glass-strong p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {ready ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-blue">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-[#0a66c2]" />
          )}
          <div>
            <p className="font-semibold text-foreground">
              {ready ? "Your network is ready" : "Enriching via Apify…"}
            </p>
            <p className="text-sm text-muted">
              {ready
                ? `${total} connections enriched`
                : `${enriched}/${total} connections`}
            </p>
          </div>
        </div>
      </div>

      {/* progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <motion.div
          className="h-full rounded-full bg-gradient-blue"
          animate={{ width: `${Math.round(ratio * 100)}%` }}
          transition={{ ease: "easeOut", duration: 0.4 }}
        />
      </div>

      {/* popping roster */}
      <div className="scroll-slim mt-5 flex max-h-64 flex-col gap-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {people.map((person) => (
            <motion.div
              key={person.name}
              layout
              initial={{ opacity: 0, x: -24, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2"
            >
              <Image
                src={person.avatarUrl}
                alt={person.name}
                width={34}
                height={34}
                className="rounded-full ring-2 ring-black/5"
                unoptimized
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {person.name}
                </p>
                <p className="truncate text-xs text-muted">{person.role}</p>
              </div>
              <Sparkles className="ml-auto h-3.5 w-3.5 shrink-0 text-[#0a66c2]/70" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {ready && (
          <motion.div
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GlassButton onClick={onLetsChat}>
              Let&apos;s chat
              <MessageSquare className="h-4 w-4" />
            </GlassButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

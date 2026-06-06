"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Loader2,
  MessageSquare,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import type { EnrichmentProgress, UploadPreviewPerson, UploadResponse } from "@/lib/types";
import GlassButton from "@/components/GlassButton";
import SiteMast from "@/components/SiteMast";
import Switch from "@/components/ui/Switch";

const LINKEDIN_EXPORT_URL =
  "https://www.linkedin.com/mypreferences/d/download-my-data";

type Step = "import" | "consent" | "enriching" | "ready";
type MessageAccessMode = "full" | "metadata";

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("import");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState<{ jobId: string; total: number } | null>(null);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [roster, setRoster] = useState<UploadPreviewPerson[]>([]);
  const [hasMessagesFile, setHasMessagesFile] = useState(false);
  const [messagesMode, setMessagesMode] = useState<MessageAccessMode>("full");
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
    setRoster([]);
    setHasMessagesFile(false);
    setProgress(null);
    setJob(null);
    setStep("enriching");
    const form = new FormData();
    if (fileRef.current) form.append("file", fileRef.current);
    form.append("messages_mode", messagesMode);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = (await res.json()) as UploadResponse;
    setRoster(data.previewConnections);
    setHasMessagesFile(data.hasMessagesFile);
    setProgress({
      jobId: data.jobId,
      total: data.totalConnections,
      enrichedCount: 0,
      ratio: 0,
      status: "processing_connections",
    });
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
    const id = setInterval(tick, 280);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [step, job]);

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden">
      <div className="aurora" aria-hidden />

      <SiteMast />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-xl">
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
                    : "border-border bg-surface hover:bg-[#f2f4f6]"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip,.csv"
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
                    The whole .zip — we&apos;ll pull out Connections.csv &amp;
                    messages.csv
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

                <div className="mt-5 border-t border-black/[0.06] pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Message access
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        We&apos;ll always import{" "}
                        <span className="font-medium text-foreground">Connections.csv</span>.
                        If your ZIP also includes{" "}
                        <span className="font-medium text-foreground">messages.csv</span>,
                        this switch controls whether the assistant can search actual
                        message text or only use relationship strength and recency.
                      </p>
                    </div>
                    <Switch
                      checked={messagesMode === "full"}
                      onCheckedChange={(checked) =>
                        setMessagesMode(checked ? "full" : "metadata")
                      }
                      ariaLabel="Enable LinkedIn message content access"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {messagesMode === "full"
                          ? "Message content enabled"
                          : "Relationship-only mode"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {messagesMode === "full"
                          ? "The assistant can search discussion topics from imported LinkedIn messages."
                          : "The assistant only uses message counts and recency, not the text itself."}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      messagesMode === "full"
                        ? "bg-[#0a66c2]/10 text-[#0a66c2]"
                        : "bg-black/[0.06] text-muted"
                    }`}>
                      {messagesMode === "full" ? "Full" : "Metadata"}
                    </span>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-muted">
                    Your import stays private to your account and isn&apos;t shared.
                  </p>
                </div>

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
                roster={roster}
                hasMessagesFile={hasMessagesFile}
              />
            </Stage>
          )}
        </AnimatePresence>
        </div>
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
      <div className="rounded-3xl rounded-tl-lg glass-strong px-5 py-4">{children}</div>
    </div>
  );
}

function EnrichmentPanel({
  progress,
  ready,
  onLetsChat,
  roster,
  hasMessagesFile,
}: {
  progress: EnrichmentProgress | null;
  ready: boolean;
  onLetsChat: () => void;
  roster: UploadPreviewPerson[];
  hasMessagesFile: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const total = progress?.total ?? roster.length;
  const ratio = ready ? 1 : progress?.ratio ?? 0;
  const revealed = Math.min(total, Math.ceil(total * ratio));
  const people = roster.slice(0, revealed);
  const isPreparing = !progress;
  const isProcessingMessages = progress?.status === "processing_messages";
  const hasFailed = progress?.status === "failed";

  // Follow the list as new connections stream in.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealed]);

  return (
    <div className="rounded-3xl glass-strong p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {ready || hasFailed ? null : (
            <Loader2 className="h-6 w-6 animate-spin text-[#0a66c2]" />
          )}
          <div>
            <p className="font-semibold text-foreground">
              {ready
                ? "Your network is ready"
                : hasFailed
                  ? "Import failed"
                  : isPreparing
                    ? "Reading your LinkedIn export..."
                    : isProcessingMessages
                      ? "Processing message history..."
                      : "Importing your network..."}
            </p>
            <p className="text-sm text-muted">
              {ready
                ? `${total} connections imported`
                : hasFailed
                  ? "We couldn't finish saving this export."
                  : isPreparing
                    ? "Parsing Connections.csv"
                    : isProcessingMessages
                      ? "Connections imported. Updating relationship signals from messages.csv"
                      : `${revealed}/${total} connections processed`}
            </p>
          </div>
        </div>
      </div>

      {hasMessagesFile && !isPreparing && !ready && !hasFailed && (
        <p className="mt-3 text-xs text-muted">
          {isProcessingMessages
            ? "`messages.csv` detected. Matching conversations to your current connections."
            : "`messages.csv` detected. Message history will be used for relationship signals."}
        </p>
      )}

      {/* progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <motion.div
          className="h-full rounded-full bg-gradient-blue"
          animate={{ width: `${Math.round(ratio * 100)}%` }}
          transition={{ ease: "easeOut", duration: 0.4 }}
        />
      </div>

      {/* streaming roster (auto-scrolls down) */}
      <div
        ref={listRef}
        className="scroll-slim mt-5 flex max-h-64 flex-col gap-2 overflow-y-auto scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {isPreparing && (
            <motion.div
              key="preparing"
              initial={{ opacity: 0, x: -24, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2"
            >
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#0a66c2]/10 text-xs font-semibold text-[#0a66c2]">
                ZIP
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  Inspecting export contents
                </p>
                <p className="truncate text-xs text-muted">
                  Looking for `Connections.csv` and `messages.csv`
                </p>
              </div>
            </motion.div>
          )}
          {people.map((person, i) => (
            <motion.div
              key={`${person.name}-${i}`}
              initial={{ opacity: 0, x: -24, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2"
            >
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#0a66c2]/10 text-xs font-semibold text-[#0a66c2] ring-2 ring-black/5">
                {person.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {person.name}
                </p>
                <p className="truncate text-xs text-muted">
                  {person.detail ?? "No role data in export"}
                </p>
              </div>
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

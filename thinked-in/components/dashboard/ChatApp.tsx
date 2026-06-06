"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import type { ChatMessage, ChatSession, PostData, ProfileCardData, ToolCallInfo } from "@/lib/types";
import { loadSessions, saveSessions } from "@/lib/sessions-store";
import logo from "@/public/thinkedinBACK.png";
import BackgroundFX from "@/components/BackgroundFX";
import ChatSidebar from "./ChatSidebar";
import ChatThread from "./ChatThread";
import ChatInput from "./ChatInput";

const EXAMPLE_PROMPTS = [
  "Find me someone who owns a software company in England",
  "Who can refer me for a tech internship?",
  "Any recruiters at fintech companies?",
];

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

function newSession(): ChatSession {
  return {
    id: uid(),
    title: "New chat",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export default function ChatApp({ onReimport }: { onReimport: () => void }) {
  const { user } = useUser();

  // Load persisted sessions once (ChatApp only mounts client-side, after
  // DashboardApp resolves), falling back to a fresh chat on first run.
  const [state, setState] = useState<{ sessions: ChatSession[]; activeId: string }>(
    () => {
      const loaded = loadSessions();
      const sessions = loaded.length ? loaded : [newSession()];
      return { sessions, activeId: sessions[0].id };
    },
  );
  const { sessions, activeId } = state;
  const setSessions = (
    updater: ChatSession[] | ((prev: ChatSession[]) => ChatSession[]),
  ) =>
    setState((st) => ({
      ...st,
      sessions:
        typeof updater === "function"
          ? (updater as (prev: ChatSession[]) => ChatSession[])(st.sessions)
          : updater,
    }));
  const setActiveId = (id: string) => setState((st) => ({ ...st, activeId: id }));

  const [streaming, setStreaming] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Persist history to the store (skip while streaming to avoid thrashing).
  useEffect(() => {
    if (!streaming) saveSessions(sessions);
  }, [sessions, streaming]);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];

  /** Patch the active session's message list immutably. */
  const patchActive = (fn: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? { ...s, messages: fn(s.messages), updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  };

  const handleNewChat = () => {
    // If already on a blank chat, just stay there (avoids empty duplicates).
    if (active && active.messages.length === 0) return;
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
  };

  const handleDeleteChat = (id: string) => {
    setState((st) => {
      const remaining = st.sessions.filter((session) => session.id !== id);
      const sessions = remaining.length ? remaining : [newSession()];
      const activeStillExists = sessions.some((session) => session.id === st.activeId);
      const activeId = activeStillExists
        ? st.activeId
        : sessions[0]?.id ?? newSession().id;

      return { sessions, activeId };
    });
  };

  const sendMessage = async (text: string) => {
    if (streaming) return;
    const assistantId = uid();
    const isFirst = active.messages.length === 0;

    // Append user message + a pending assistant placeholder.
    patchActive((msgs) => [
      ...msgs,
      { id: uid(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);

    // Title the session from the first prompt.
    if (isFirst) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId
            ? { ...s, title: text.length > 38 ? `${text.slice(0, 38)}…` : text }
            : s,
        ),
      );
    }

    setStreaming(true);
    try {
      await streamReply(text, active.messages, assistantId, patchActive);
    } catch {
      patchActive((msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                pending: false,
                content:
                  m.content || "Something went wrong reaching your network. Try again.",
              }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Mobile drawer backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden
          onClick={() => setNavOpen(false)}
        />
      )}

      <ChatSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onDelete={handleDeleteChat}
        onNewChat={handleNewChat}
        onReimport={onReimport}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with menu toggle */}
        <div className="relative z-10 flex items-center gap-3 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-foreground transition hover:bg-black/[0.05] active:scale-90"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image src={logo} alt="thinkedin" className="h-6 w-auto" />
        </div>

        <BackgroundFX light />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {active.messages.length === 0 ? (
            <EmptyState
              name={user?.firstName ?? null}
              onPick={sendMessage}
            />
          ) : (
            <ChatThread messages={active.messages} />
          )}
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function EmptyState({
  name,
  onPick,
}: {
  name: string | null;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <motion.h1
        className="text-3xl font-semibold text-white drop-shadow-[0_2px_10px_rgba(12,74,140,0.4)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {name ? `Hi ${name}, ` : "Hi, "}
        <span className="text-white/85">talk to your network</span>
      </motion.h1>
      <motion.p
        className="mt-2 max-w-md text-white/85 drop-shadow-[0_1px_8px_rgba(12,74,140,0.35)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
      >
        Ask in plain English and I&apos;ll find the right people from your LinkedIn
        connections.
      </motion.p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((p, i) => (
          <motion.button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm transition-all hover:scale-[1.03] hover:bg-black/[0.04] hover:shadow active:scale-95"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.18 + i * 0.07 }}
          >
            {p}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/**
 * Reads the NDJSON stream from /api/chat. Each agent turn emits turn_start /
 * turn_end events that map to separate ChatMessage bubbles. Tool-call turns
 * are rendered as compact "thinking" steps; the final answer is a full bubble.
 *
 * assistantId is the ID of the placeholder message already in the session
 * (created by sendMessage before the fetch). The first turn_start reuses it;
 * subsequent turns append new messages.
 */
async function streamReply(
  message: string,
  history: ChatMessage[],
  assistantId: string,
  patchActive: (fn: (msgs: ChatMessage[]) => ChatMessage[]) => void,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // stepMsgId tracks which message is currently receiving deltas.
  let stepMsgId = assistantId;
  let turnCount = 0;

  const updateCurrent = (patch: (m: ChatMessage) => ChatMessage) =>
    patchActive((msgs) => msgs.map((m) => (m.id === stepMsgId ? patch(m) : m)));

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;

      const event = JSON.parse(line) as
        | { type: "turn_start" }
        | { type: "turn_end"; tools: ToolCallInfo[] }
        | { type: "delta"; text: string }
        | { type: "matches"; matches: ProfileCardData[] }
        | { type: "post"; post: PostData };

      if (event.type === "turn_start") {
        if (turnCount === 0) {
          // First turn reuses the placeholder message already in the session.
          stepMsgId = assistantId;
        } else {
          // Subsequent turns get a fresh message appended to the session.
          const newId = uid();
          stepMsgId = newId;
          patchActive((msgs) => [
            ...msgs,
            { id: newId, role: "assistant", content: "", pending: true },
          ]);
        }
        turnCount++;
      } else if (event.type === "turn_end") {
        updateCurrent((m) => ({
          ...m,
          pending: false,
          kind: event.tools.length > 0 ? "thinking" : "answer",
          toolNames: event.tools.length > 0 ? event.tools.map((t) => t.name) : undefined,
          toolCalls: event.tools.length > 0 ? event.tools : undefined,
        }));
      } else if (event.type === "delta") {
        updateCurrent((m) => ({ ...m, content: m.content + event.text }));
      } else if (event.type === "matches") {
        updateCurrent((m) => ({ ...m, matches: event.matches }));
      } else if (event.type === "post") {
        updateCurrent((m) => ({ ...m, post: event.post }));
      }
    }
  }

  // Ensure the last message is never left pending (guards against stream errors).
  updateCurrent((m) => ({ ...m, pending: false }));
}

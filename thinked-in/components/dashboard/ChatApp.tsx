"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

const BOOTSTRAP_SESSION: ChatSession = {
  id: "bootstrap-session",
  title: "New chat",
  updatedAt: "",
  messages: [],
};

const BOOTSTRAP_STATE = {
  sessions: [BOOTSTRAP_SESSION],
  activeId: BOOTSTRAP_SESSION.id,
};

const subscribeHydration = () => () => {};

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
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [clientState, setClientState] = useState<{ sessions: ChatSession[]; activeId: string } | null>(null);
  const state = useMemo(() => {
    if (clientState) return clientState;
    if (!isHydrated) return BOOTSTRAP_STATE;
    const loaded = loadSessions();
    const sessions = loaded.length ? loaded : [newSession()];
    return { sessions, activeId: sessions[0].id };
  }, [clientState, isHydrated]);
  const { sessions, activeId } = state;
  const setSessions = (
    updater: ChatSession[] | ((prev: ChatSession[]) => ChatSession[]),
  ) =>
    setClientState((st) => {
      const base = st ?? state;
      return {
        ...base,
        sessions:
          typeof updater === "function"
            ? (updater as (prev: ChatSession[]) => ChatSession[])(base.sessions)
            : updater,
      };
    });
  const setActiveId = (id: string) =>
    setClientState((st) => {
      const base = st ?? state;
      return { ...base, activeId: id };
    });

  const [streaming, setStreaming] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Persist history to the store (skip while streaming to avoid thrashing).
  useEffect(() => {
    if (isHydrated && clientState && !streaming) saveSessions(sessions);
  }, [sessions, streaming, isHydrated, clientState]);

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
    setClientState((st) => {
      const base = st ?? state;
      const remaining = base.sessions.filter((session) => session.id !== id);
      const sessions = remaining.length ? remaining : [newSession()];
      const activeStillExists = sessions.some((session) => session.id === base.activeId);
      const activeId = activeStillExists
        ? base.activeId
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
      {navOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden
          onClick={() => setNavOpen(false)}
        />
      ) : null}

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
        className="font-serif-ui text-3xl font-light tracking-[0.01em] text-slate-700"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {name ? `Hi ${name}, ` : "Hi, "}
        <span className="text-slate-600">talk to your network</span>
      </motion.h1>
      <motion.p
        className="font-serif-ui mt-2 max-w-md text-base font-light leading-relaxed text-slate-600"
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

  const patchMessage = (messageId: string, patch: (m: ChatMessage) => ChatMessage) =>
    patchActive((msgs) => msgs.map((m) => (m.id === messageId ? patch(m) : m)));

  const updateCurrent = (patch: (m: ChatMessage) => ChatMessage) => {
    const currentId = stepMsgId;
    patchMessage(currentId, patch);
  };

  const hasRenderablePayload = (msg: ChatMessage, toolCount = msg.toolCalls?.length ?? 0) =>
    msg.content.trim().length > 0 ||
    Boolean(msg.matches?.length) ||
    Boolean(msg.post) ||
    toolCount > 0;

  const finalizeMessage = (messageId: string, tools: ToolCallInfo[]) =>
    patchActive((msgs) =>
      msgs.flatMap((msg) => {
        if (msg.id !== messageId) return [msg];
        if (!hasRenderablePayload(msg, tools.length)) return [];
        return [{
          ...msg,
          pending: false,
          kind: tools.length > 0 ? "thinking" : "answer",
          toolNames: tools.length > 0 ? tools.map((tool) => tool.name) : undefined,
          toolCalls: tools.length > 0 ? tools : undefined,
        }];
      }),
    );

  const clearPendingState = (messageId: string) =>
    patchActive((msgs) =>
      msgs.flatMap((msg) => {
        if (msg.id !== messageId) return [msg];
        if (!hasRenderablePayload(msg)) return [];
        return [{ ...msg, pending: false }];
      }),
    );

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
        | { type: "tool_call"; name: string; input: Record<string, unknown> }
        | { type: "tool_result"; name: string; resultCount: number | null }
        | { type: "matches"; matches: ProfileCardData[] }
        | { type: "post"; post: PostData };

      if (event.type === "turn_start") {
        if (turnCount === 0) {
          stepMsgId = assistantId;
        } else {
          const newId = uid();
          stepMsgId = newId;
          patchActive((msgs) => [
            ...msgs,
            { id: newId, role: "assistant", content: "", pending: true },
          ]);
        }
        turnCount++;
      } else if (event.type === "turn_end") {
        const currentId = stepMsgId;
        finalizeMessage(currentId, event.tools);
      } else if (event.type === "delta") {
        updateCurrent((m) => ({ ...m, content: m.content + event.text }));
      } else if (event.type === "tool_call") {
        updateCurrent((m) => ({
          ...m,
          kind: "thinking",
          toolCalls: [
            ...(m.toolCalls ?? []),
            { name: event.name, input: event.input, resultCount: null, loading: true },
          ],
        }));
      } else if (event.type === "tool_result") {
        updateCurrent((m) => {
          const toolCalls = [...(m.toolCalls ?? [])];
          for (let i = toolCalls.length - 1; i >= 0; i--) {
            if (toolCalls[i]?.name === event.name && toolCalls[i]?.loading) {
              toolCalls[i] = {
                ...toolCalls[i],
                resultCount: event.resultCount,
                loading: false,
              };
              return { ...m, toolCalls };
            }
          }
          toolCalls.push({
            name: event.name,
            input: {},
            resultCount: event.resultCount,
            loading: false,
          });
          return { ...m, toolCalls };
        });
      } else if (event.type === "matches") {
        updateCurrent((m) => ({ ...m, matches: event.matches }));
      } else if (event.type === "post") {
        updateCurrent((m) => ({ ...m, post: event.post }));
      }
    }
  }

  // Ensure the last message is never left pending (guards against stream errors).
  clearPendingState(stepMsgId);
}

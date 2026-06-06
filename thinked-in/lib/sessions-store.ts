import type { ChatSession } from "./types";

// Persistent chat-session store. Currently backed by localStorage (the stubbed
// "database"); swap these two functions for Supabase reads/writes when the
// backend lands and the rest of the app stays unchanged.
const KEY = "thinkedin:sessions";
const MAX_SESSIONS = 50;

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      ...s,
      messages: Array.isArray(s?.messages) ? s.messages : [],
    })) as ChatSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    // Don't persist transient streaming flags (JSON.stringify drops undefined).
    const clean = sessions.slice(0, MAX_SESSIONS).map((s) => ({
      ...s,
      messages: s.messages.map((m) => ({ ...m, pending: undefined })),
    }));
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // storage full / unavailable — ignore
  }
}

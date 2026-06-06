/**
 * Shared event contract between the extension (producer) and POST /api/events
 * (consumer). Kept in sync with thinked-in-extension/shared/events.ts.
 *
 * Dependency-free + browser-safe so the extension can import the same shape.
 */

export type LinkedInEventKind = "profile_view"; // MVP. Later: "connection_seen" | "message_seen".

export interface ProfileViewEvent {
  kind: "profile_view";
  /** Raw live profile URL as seen in the address bar. The backend normalizes it. */
  url: string;
  /** ISO timestamp the user viewed the profile. */
  observedAt: string;
  name?: string | null;
  headline?: string | null;
  /** Current title, read from the live profile. */
  position?: string | null;
  /** Current company, read from the live profile. */
  company?: string | null;
  /** LinkedIn vanity slug, e.g. "ada-lovelace-8b3a21". */
  publicIdentifier?: string | null;
}

export type LinkedInEvent = ProfileViewEvent;

export interface EventsBatch {
  events: LinkedInEvent[];
}

/** Counts the popup renders. messages stays 0 until the message channel is wired. */
export interface CaptureCounts {
  today: { profiles: number; messages: number };
  allTime: { profiles: number; messages: number };
}

const KINDS: LinkedInEventKind[] = ["profile_view"];

/**
 * Validate + sanitize an untrusted batch from the wire. Drops malformed events;
 * returns the clean batch, or null if the envelope itself is invalid.
 */
export function parseEventsBatch(body: unknown): EventsBatch | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { events?: unknown }).events;
  if (!Array.isArray(raw)) return null;

  const events: LinkedInEvent[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    if (!KINDS.includes(ev.kind as LinkedInEventKind)) continue;
    if (typeof ev.url !== "string" || !ev.url.trim()) continue;
    const str = (k: string) => (typeof ev[k] === "string" ? (ev[k] as string) : null);
    events.push({
      kind: "profile_view",
      url: ev.url.trim(),
      observedAt: typeof ev.observedAt === "string" ? ev.observedAt : new Date().toISOString(),
      name: str("name"),
      headline: str("headline"),
      position: str("position"),
      company: str("company"),
      publicIdentifier: str("publicIdentifier"),
    });
  }
  return { events };
}

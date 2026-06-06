import Papa from "papaparse";
import { firstUrl } from "./url";
import type { ParsedMessage } from "./types";

const clean = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s.length ? s : null;
};

/** Parse LinkedIn's "2026-06-05 10:08:47 UTC" date format into a Date (or null). */
export function parseMessageDate(raw: string | null | undefined): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const iso = s.replace(" UTC", "Z").replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface RawMessageRow {
  conversationId: string | null;
  from: string | null;
  senderProfileUrl: string | null;
  to: string | null;
  recipientProfileUrls: string | null;
  date: string | null;
  subject: string | null;
  content: string | null;
}

function mapRow(row: Record<string, string>): RawMessageRow {
  return {
    conversationId: clean(row["CONVERSATION ID"]),
    from: clean(row["FROM"]),
    senderProfileUrl: clean(row["SENDER PROFILE URL"]),
    to: clean(row["TO"]),
    recipientProfileUrls: clean(row["RECIPIENT PROFILE URLS"]),
    date: clean(row["DATE"]),
    subject: clean(row["SUBJECT"]),
    content: clean(row["CONTENT"]),
  };
}

/**
 * The account owner is the participant present in (essentially) every message —
 * we pick the name that appears most often across FROM/TO.
 */
export function detectOwner(rows: RawMessageRow[]): { name: string; profileUrl: string | null } {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.from) counts.set(r.from, (counts.get(r.from) ?? 0) + 1);
    if (r.to) counts.set(r.to, (counts.get(r.to) ?? 0) + 1);
  }
  let name = "";
  let best = -1;
  for (const [n, c] of counts) {
    if (c > best) {
      best = c;
      name = n;
    }
  }

  let profileUrl: string | null = null;
  for (const r of rows) {
    if (r.from === name && r.senderProfileUrl) {
      profileUrl = r.senderProfileUrl;
      break;
    }
    if (r.to === name && r.recipientProfileUrls) {
      profileUrl = firstUrl(r.recipientProfileUrls);
      if (profileUrl) break;
    }
  }
  return { name, profileUrl };
}

function toParsed(r: RawMessageRow, ownerName: string): ParsedMessage {
  const isSent = r.from === ownerName;
  return {
    conversationId: r.conversationId,
    direction: isSent ? "sent" : "received",
    partnerName: (isSent ? r.to : r.from) ?? "",
    partnerProfileUrl: isSent ? firstUrl(r.recipientProfileUrls) : r.senderProfileUrl,
    sentAt: parseMessageDate(r.date),
    subject: r.subject,
    content: r.content,
  };
}

/**
 * Parse LinkedIn's messages.csv. Returns the detected owner plus one
 * ParsedMessage per row (owner/partner resolved, direction derived).
 */
export function parseMessages(csv: string): {
  owner: { name: string; profileUrl: string | null };
  messages: ParsedMessage[];
} {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = data.map(mapRow).filter((r) => r.from || r.to);
  const owner = detectOwner(rows);
  const messages = rows.map((r) => toParsed(r, owner.name));
  return { owner, messages };
}

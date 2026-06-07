import type { ProfileCardData } from "../types";
import type { ConnectionRow } from "./retrieval";

const fullName = (r: ConnectionRow) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "Unknown";

/** Returns a real avatar URL via unavatar.io (LinkedIn → real photo), falling back to initials. */
function avatarFor(name: string, linkedinUrl?: string | null): string {
  if (linkedinUrl) {
    const username = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
    if (username) return `https://unavatar.io/linkedin/${encodeURIComponent(username)}`;
  }
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0a66c2&textColor=ffffff&fontSize=40`;
}

/** Map a retrieval row to the card shape the chat UI renders. */
export function toCard(r: ConnectionRow): ProfileCardData {
  const name = fullName(r);
  const location = r.location ?? r.country ?? null;
  return {
    id: r.id,
    name,
    position: r.position ?? "",
    company: r.company ?? "",
    location,
    avatarUrl: avatarFor(name, r.linkedin_url),
    linkedinUrl: r.linkedin_url ?? "",
  };
}

/** De-dupe by id, preserving order (multiple searches can overlap). */
export function dedupeCards(cards: ProfileCardData[]): ProfileCardData[] {
  const seen = new Set<string>();
  const out: ProfileCardData[] = [];
  for (const c of cards) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

// Stubbed "backend" search. The real version will do Claude intent extraction
// + pgvector similarity search over the user's connections. For now this is a
// naive keyword/filter match over the mock network so the demo lands.

import { networkConnections } from "./mock-data";
import type { Connection, ProfileCardData } from "./types";

const ENGLAND_TERMS = ["england", "english", "uk", "u.k.", "britain", "british", "london", "manchester", "leeds", "bristol"];
const FOUNDER_TERMS = ["founder", "co-founder", "cofounder", "owns", "owner", "own a", "ceo", "runs a", "started a"];
const SOFTWARE_TERMS = ["software", "saas", "tech company", "startup", "engineering company"];
const RECRUIT_TERMS = ["recruit", "recruiter", "internship", "intern", "refer", "referral", "hire", "hiring", "early career", "grad"];

function toCard(c: Connection): ProfileCardData {
  return {
    id: c.id,
    name: c.name,
    position: c.position,
    company: c.company,
    location: c.location,
    avatarUrl: c.avatarUrl,
    linkedinUrl: c.linkedinUrl,
  };
}

function hasAny(haystack: string, terms: string[]) {
  return terms.some((t) => haystack.includes(t));
}

export interface SearchResult {
  matches: ProfileCardData[];
  reply: string;
}

export function searchNetwork(message: string): SearchResult {
  const q = message.toLowerCase();

  const wantEngland = hasAny(q, ENGLAND_TERMS);
  const wantFounder = hasAny(q, FOUNDER_TERMS);
  const wantSoftware = hasAny(q, SOFTWARE_TERMS);
  const wantRecruit = hasAny(q, RECRUIT_TERMS);

  const scored = networkConnections
    .map((c) => {
      let score = 0;
      const inEngland = (c.country ?? "").toLowerCase() === "england";
      const isSoftware = (c.industry ?? "").toLowerCase() === "software";
      const isFounder = c.seniority === "founder" || c.seniority === "c-suite";
      const recruits = c.skills.some((s) =>
        ["recruiting", "interns", "early careers", "hiring", "tech hiring", "internships"].includes(
          s.toLowerCase(),
        ),
      );

      if (wantEngland && inEngland) score += 3;
      if (wantSoftware && isSoftware) score += 3;
      if (wantFounder && isFounder) score += 3;
      if (wantRecruit && recruits) score += 3;

      // soft keyword overlap on position/company/skills
      const blob = `${c.position} ${c.company} ${c.industry ?? ""} ${c.skills.join(" ")}`.toLowerCase();
      for (const word of q.split(/\W+/).filter((w) => w.length > 3)) {
        if (blob.includes(word)) score += 1;
      }

      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = (scored.length ? scored : networkConnections.slice(0, 3).map((c) => ({ c, score: 0 })))
    .slice(0, 3)
    .map((s) => s.c);

  return { matches: top.map(toCard), reply: buildReply(message, top) };
}

function buildReply(message: string, people: Connection[]): string {
  if (!people.length) {
    return "I couldn't find anyone in your network matching that yet. Try rephrasing, or import more connections.";
  }

  const intro = `Based on your network, here ${people.length === 1 ? "is" : "are"} the strongest ${
    people.length === 1 ? "match" : `${people.length} matches`
  } for "${message.trim()}":`;

  const lines = people.map((p) => {
    const where = p.location ? ` (${p.location})` : "";
    return `• **${p.name}** — ${p.position} at ${p.company}${where}. ${p.summary ?? ""}`.trim();
  });

  const outro =
    "Want an intro angle for any of them, or should I narrow it down further?";

  return [intro, "", ...lines, "", outro].join("\n");
}

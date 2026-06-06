import type { Seniority } from "./types";

/**
 * Infer a coarse seniority bucket from a job title.
 *
 * Acronyms (vp, cto, ceo…) are matched as WHOLE WORDS, not substrings — otherwise
 * "direCTOr" would match "cto" and every Director would look like c-suite. Multi-word
 * terms ("vice president", "head of") are matched as phrases on the full string.
 * Order matters: VP is checked before founder so "Vice President" isn't caught by the
 * "president" keyword.
 */
export function inferSeniority(title: string | null | undefined): Seniority {
  const t = (title ?? "").toLowerCase().trim();
  if (!t) return "ic";

  const tokens = new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
  const hasWord = (...ws: string[]) => ws.some((w) => tokens.has(w));
  const hasPhrase = (...ps: string[]) => ps.some((p) => t.includes(p));

  if (hasPhrase("vice president") || hasWord("vp", "svp", "evp")) return "vp";
  if (hasWord("founder", "owner", "ceo", "president") || hasPhrase("co-founder", "cofounder")) return "founder";
  if (hasWord("cto", "cfo", "coo", "cpo", "cmo", "ciso") || hasPhrase("chief", "c-suite")) return "c-suite";
  if (hasWord("director") || hasPhrase("head of")) return "director";
  if (hasWord("manager", "lead")) return "manager";
  return "ic";
}

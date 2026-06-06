import type { ProfileLike } from "./types";

/**
 * Build the text blob that gets embedded for semantic search.
 * Mirrors the template in build_plan.md. Sections are omitted when empty so a
 * pre-enrichment profile (CSV-only) still produces a sensible blob.
 */
export function buildProfileText(p: ProfileLike): string {
  const lines: string[] = [];

  const head = [
    p.fullName,
    p.position ? `, ${p.position}` : "",
    p.company ? ` at ${p.company}` : "",
  ].join("");
  lines.push(`${head}.`);

  const loc = [p.city, p.country].filter(Boolean).join(", ");
  if (loc) lines.push(`Location: ${loc}.`);

  if (p.summary) lines.push(`About: ${p.summary}.`);

  if (p.experience && p.experience.length) {
    const exp = p.experience
      .slice(0, 3)
      .map((e) => [e.title, e.company].filter(Boolean).join(" at "))
      .filter(Boolean)
      .join(", ");
    if (exp) lines.push(`Experience: ${exp}.`);
  }

  if (p.skills && p.skills.length) {
    lines.push(`Skills: ${p.skills.slice(0, 8).join(", ")}.`);
  }

  if (p.industry) lines.push(`Industry: ${p.industry}.`);

  return lines.join("\n");
}

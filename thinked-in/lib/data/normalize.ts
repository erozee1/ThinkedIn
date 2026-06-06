// Canonicalize messy LinkedIn/Apify location & company strings into stable values
// the agent's filters can match reliably. See build_plan.md "Filters must be fuzzy".

const UK_TOKENS = [
  "united kingdom",
  "great britain",
  "u.k.",
  "uk",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "greater london",
  "london area",
  "london",
];

const US_TOKENS = [
  "united states",
  "u.s.a.",
  "u.s.",
  "usa",
  "america",
];

/**
 * Map a free-text location to a canonical lowercase country.
 * UK/US variants are special-cased (the most common LinkedIn noise); otherwise
 * we fall back to the last comma-separated segment.
 */
export function normalizeCountry(location: string | null | undefined): string | null {
  if (!location) return null;
  const loc = location.toLowerCase();
  if (UK_TOKENS.some((t) => loc.includes(t))) return "united kingdom";
  if (US_TOKENS.some((t) => loc.includes(t))) return "united states";

  const parts = location
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : location.trim();
  return last.toLowerCase() || null;
}

const COMPANY_SUFFIXES = new Set([
  "llc", "ltd", "limited", "inc", "incorporated", "gmbh", "plc", "co",
  "corp", "corporation", "sa", "ag", "bv", "pty", "llp", "lp",
]);

const COMPANY_QUALIFIERS = new Set([
  "uk", "usa", "us", "emea", "apac", "global", "international", "worldwide",
]);

/**
 * Lowercase a company and strip legal suffixes / country qualifiers.
 *   "Google LLC" -> "google" ,  "Google UK" -> "google"
 */
export function normalizeCompany(company: string | null | undefined): string | null {
  if (!company) return null;
  const cleaned = company.toLowerCase().replace(/[.,]/g, " ");
  let tokens = cleaned.split(/\s+/).filter(Boolean);
  while (
    tokens.length > 1 &&
    (COMPANY_SUFFIXES.has(tokens[tokens.length - 1]) ||
      COMPANY_QUALIFIERS.has(tokens[tokens.length - 1]))
  ) {
    tokens = tokens.slice(0, -1);
  }
  return tokens.join(" ") || null;
}

import Papa from "papaparse";
import type { RawConnection } from "./types";

const clean = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s.length ? s : null;
};

/**
 * Build a fallback LinkedIn URL when the export omits it.
 *   "Ada", "Lovelace" -> https://linkedin.com/in/ada-lovelace
 */
function fallbackUrl(first: string | null, last: string | null): string | null {
  const slug = [first, last]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug ? `https://linkedin.com/in/${slug}` : null;
}

/**
 * Parse LinkedIn's Connections.csv.
 *
 * The export starts with a 2–3 line "Notes:" preamble before the real header
 * row, so we slice from the first line beginning with "First Name". Columns are
 * mapped by header name (their order varies between export versions).
 */
export function parseConnections(csv: string): RawConnection[] {
  const lines = csv.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.trimStart().startsWith("First Name"));
  if (headerIdx === -1) {
    throw new Error("Connections.csv: could not find the 'First Name' header row");
  }
  const sliced = lines.slice(headerIdx).join("\n");

  const { data } = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return data
    .map((row): RawConnection => {
      const firstName = clean(row["First Name"]) ?? "";
      const lastName = clean(row["Last Name"]) ?? "";
      return {
        firstName,
        lastName,
        email: clean(row["Email Address"]),
        company: clean(row["Company"]),
        position: clean(row["Position"]),
        connectedOn: clean(row["Connected On"]),
        linkedinUrl: clean(row["URL"]) ?? fallbackUrl(firstName || null, lastName || null),
      };
    })
    .filter((c) => c.firstName || c.lastName);
}

export const fullName = (c: { firstName: string; lastName: string }): string =>
  [c.firstName, c.lastName].filter(Boolean).join(" ").trim();

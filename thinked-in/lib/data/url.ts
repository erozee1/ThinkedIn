/**
 * Normalize a LinkedIn profile URL so connections and messages can be matched
 * regardless of protocol, www, trailing slash, or query string.
 *
 *   https://www.linkedin.com/in/Ilhan-Toygan/?foo=bar  ->  linkedin.com/in/ilhan-toygan
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim().toLowerCase();
  if (!u) return null;
  u = u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  u = u.split("?")[0].split("#")[0];
  u = u.replace(/\/+$/, "");
  return u || null;
}

/** Messages can list several recipient URLs separated by whitespace/commas; take the first. */
export function firstUrl(urls: string | null | undefined): string | null {
  if (!urls) return null;
  const first = urls.trim().split(/[\s,]+/).filter(Boolean)[0];
  return first || null;
}

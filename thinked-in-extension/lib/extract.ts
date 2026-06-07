// Scroll-free profile extraction from data LinkedIn already embeds in the page.
// Tries the most reliable structured sources first, and guards against stale
// SSR data left over from a previously-viewed profile (SPA navigation) by
// checking the data references the current slug.

export interface ExtractedFields {
  name: string | null;
  headline: string | null;
  position: string | null;
  company: string | null;
  source: string | null;
}

const clean = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
};

// 1) schema.org Person in <script type="application/ld+json"> — cleanest.
function fromJsonLd(slug: string): ExtractedFields | null {
  for (const node of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(node.textContent || "");
    } catch {
      continue;
    }
    const root = parsed as Record<string, unknown>;
    const graph = (root["@graph"] as Record<string, unknown>[]) ?? (Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [root]);
    const person = graph.find((n) => n && n["@type"] === "Person");
    if (!person) continue;
    const url = String(person.url ?? "").toLowerCase();
    if (slug && url && !url.includes(slug.toLowerCase())) continue; // stale → skip
    const jobTitle = person.jobTitle;
    const job = Array.isArray(jobTitle) ? jobTitle[0] : jobTitle;
    const worksForRaw = person.worksFor;
    const works = (Array.isArray(worksForRaw) ? worksForRaw[0] : worksForRaw) as Record<string, unknown> | undefined;
    const fields: ExtractedFields = {
      name: clean(person.name),
      headline: clean(person.description),
      position: clean(job),
      company: clean(works?.name),
      source: "json-ld",
    };
    if (fields.name || fields.position || fields.company) return fields;
  }
  return null;
}

// 2) Voyager model embedded in <code> blocks (present in the logged-in app).
function fromVoyager(slug: string): ExtractedFields | null {
  const needle = slug.toLowerCase();
  for (const code of Array.from(document.querySelectorAll("code"))) {
    const txt = code.textContent || "";
    if (txt.length < 50 || !txt.includes('"firstName"')) continue;
    if (needle && !txt.toLowerCase().includes(needle)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(txt);
    } catch {
      continue;
    }
    const included = (parsed as { included?: Record<string, unknown>[] })?.included;
    if (!Array.isArray(included)) continue;
    const person = included.find(
      (e) =>
        e &&
        typeof e.firstName === "string" &&
        (e.publicIdentifier ? needle.includes(String(e.publicIdentifier).toLowerCase()) : true),
    );
    if (!person) continue;
    return {
      name: clean([person.firstName, person.lastName].filter(Boolean).join(" ")),
      headline: clean(person.headline),
      position: null,
      company: null,
      source: "voyager",
    };
  }
  return null;
}

// 3) og: meta tags — usually present; "First Last - Title - Company | LinkedIn".
function fromMeta(): ExtractedFields | null {
  const meta = (p: string) =>
    clean((document.querySelector(`meta[property="${p}"]`) as HTMLMetaElement | null)?.content);
  const title = meta("og:title");
  const desc = meta("og:description");
  if (!title && !desc) return null;
  return {
    name: title ? clean(title.split(/[-|–]/)[0]) : null,
    headline: desc,
    position: null,
    company: null,
    source: "og",
  };
}

// 3.2) Parse the rendered top-card text in <main>. PRIMARY source for the
//      logged-in app, which ships no <h1>/JSON-LD. main.innerText is structured:
//        Name / "· 1st" / Headline / Location / "Contact info" / Company / School …
function fromMainText(): ExtractedFields | null {
  const main = document.querySelector("main") as HTMLElement | null;
  const raw = main?.innerText;
  if (!raw) return null;
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const name = clean(lines[0]);
  if (!name) return null;

  // Headline is right after the connection-degree marker ("· 1st/2nd/3rd"),
  // or right after the name when there's no degree (e.g. your own profile).
  let idx = 1;
  if (lines[1] && /\b(1st|2nd|3rd)\b/i.test(lines[1]) && lines[1].length < 14) idx = 2;
  const headline = clean(lines[idx]);

  // Current company = first real line after "Contact info".
  let company: string | null = null;
  const ci = lines.findIndex((l) => /^contact info$/i.test(l));
  if (ci >= 0) {
    for (let j = ci + 1; j < lines.length; j++) {
      const c = lines[j];
      if (c && c !== "·" && !/^\d/.test(c) && !/connections?$/i.test(c)) {
        company = clean(c);
        break;
      }
    }
  }
  return { name, headline, position: null, company, source: "maintext" };
}

// 3.5) document.title — set by the SPA on navigation; very reliable for the name.
//      e.g. "(3) Filip Ziółkowski - CEO - Acme | LinkedIn" or "Filip Ziółkowski | LinkedIn"
function fromTitle(): ExtractedFields | null {
  const raw = (document.title || "")
    .replace(/\s*\|\s*LinkedIn.*$/i, "")
    .replace(/^\(\d+\)\s*/, "")
    .trim();
  if (!raw) return null;
  const parts = raw.split(/\s+[-–|]\s+/).map((p) => p.trim());
  const name = clean(parts[0]);
  if (!name) return null;
  return {
    name,
    headline: clean(parts.slice(1).join(" · ")),
    position: clean(parts[1]),
    company: clean(parts[2]),
    source: "title",
  };
}

// 4) Visible top card — last resort; updates on SPA nav but classes are obfuscated.
function fromDom(): ExtractedFields {
  const text = (sel: string) => clean(document.querySelector(sel)?.textContent);
  return {
    name: text("main h1") ?? text("h1"),
    headline: text("main .text-body-medium.break-words") ?? text(".text-body-medium.break-words"),
    position: null,
    company: null,
    source: "dom",
  };
}

/** Best available profile fields for the current page, with provenance. */
export function extractProfile(slug: string): ExtractedFields {
  return fromJsonLd(slug) ?? fromVoyager(slug) ?? fromMainText() ?? fromTitle() ?? fromMeta() ?? fromDom();
}

/** TEMP: snapshot of what this page exposes, so we can fix extraction. */
export function diagnostics(): Record<string, unknown> {
  const meta = (p: string) =>
    clean((document.querySelector(`meta[property="${p}"]`) as HTMLMetaElement | null)?.content);
  const lds = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const codes = Array.from(document.querySelectorAll("code"));
  const main = document.querySelector("main") as HTMLElement | null;
  return {
    title: document.title,
    h1: clean(document.querySelector("h1")?.textContent),
    mainH1: clean(document.querySelector("main h1")?.textContent),
    h1Count: document.querySelectorAll("h1").length,
    bodyTextLen: document.body?.innerText?.length ?? 0,
    mainTextLen: main?.innerText?.length ?? 0,
    mainText: clean(main?.innerText?.slice(0, 400)),
    readyState: document.readyState,
    ldCount: lds.length,
    ldHasPerson: lds.some((n) => (n.textContent || "").includes('"Person"')),
    codeCount: codes.length,
    codeHasFirstName: codes.some((c) => (c.textContent || "").includes('"firstName"')),
    ogTitle: meta("og:title"),
    ogDesc: meta("og:description"),
  };
}

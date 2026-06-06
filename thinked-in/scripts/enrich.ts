/**
 * Offline connection loader / enricher (Path A).
 *
 *   npx tsx --env-file=.env.local scripts/enrich.ts --user <clerk_user_id> [--limit N] [--apify] [csvPath]
 *
 * Baseline (default): parse Connections.csv -> infer seniority -> normalize company
 * -> embed (name/position/company) -> replace this user's rows in Supabase.
 * With --apify: also scrape each profile for location/summary/skills/industry first.
 *
 * Get your Clerk user id from the Clerk Dashboard -> Users (looks like "user_2ab...").
 * Run this BEFORE ingest-messages.ts (messages match against these connection rows).
 */
import { readFileSync } from "node:fs";
import { parseConnections, fullName } from "../lib/data/connections";
import { inferSeniority } from "../lib/data/seniority";
import { normalizeCompany, normalizeCountry } from "../lib/data/normalize";
import { buildProfileText } from "../lib/data/profile-text";
import { embedTexts, toVectorLiteral } from "../lib/embeddings";
import { scrapeProfiles } from "../lib/apify";
import { normalizeLinkedInUrl } from "../lib/data/url";
import { createAdminClient } from "../lib/supabase/admin";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (flag: string) => process.argv.includes(flag);

const userId = arg("--user");
const limit = arg("--limit") ? Number(arg("--limit")) : undefined;
const useApify = hasFlag("--apify");
const csvPath = process.argv.slice(2).find((a) => a.endsWith(".csv")) ?? "../Connections.csv";

if (!userId) {
  console.error("Missing --user <clerk_user_id>. Find it in Clerk Dashboard -> Users.");
  process.exit(1);
}

interface Enrichment {
  location?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  industry?: string | null;
  experience?: { title?: string | null; company?: string | null }[] | null;
}

/** Defensive map of an Apify profile item -> our enrichment fields (field names vary by actor). */
function mapApify(item: Record<string, unknown>): Enrichment {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = s((item as Record<string, unknown>)[k]);
      if (v) return v;
    }
    return null;
  };
  const skillsRaw = (item.skills ?? item.skillKeywords) as unknown;
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((x) => (typeof x === "string" ? x : (x as Record<string, string>)?.name)).filter(Boolean)
    : null;
  return {
    location: get("location", "geoLocationName", "addressWithCountry", "locationName"),
    summary: get("summary", "about", "headline", "occupation"),
    industry: get("industry", "industryName"),
    skills: skills && skills.length ? (skills as string[]) : null,
    experience: null, // populated after we confirm the actor's shape on a real run
  };
}

async function main() {
  const all = parseConnections(readFileSync(csvPath, "utf8"));
  const connections = limit ? all.slice(0, limit) : all;
  console.log(`Loaded ${all.length} connections${limit ? `, using first ${connections.length}` : ""}`);

  // Optional Apify enrichment, keyed by normalized URL.
  const enrichByUrl = new Map<string, Enrichment>();
  if (useApify) {
    const urls = connections.map((c) => c.linkedinUrl).filter((u): u is string => !!u);
    console.log(`Apify: scraping ${urls.length} profiles (batches of 50)...`);
    for (let i = 0; i < urls.length; i += 50) {
      const batch = urls.slice(i, i + 50);
      const items = await scrapeProfiles(batch);
      for (const item of items) {
        const u = normalizeLinkedInUrl((item.linkedinUrl ?? item.url ?? item.profileUrl) as string);
        if (u) enrichByUrl.set(u, mapApify(item));
      }
      console.log(`  scraped ${Math.min(i + 50, urls.length)}/${urls.length}`);
    }
  }

  // Build embedding text per connection (CSV + any enrichment).
  const rows = connections.map((c) => {
    const e = enrichByUrl.get(normalizeLinkedInUrl(c.linkedinUrl) ?? "") ?? {};
    const name = fullName(c);
    const text = buildProfileText({
      fullName: name,
      position: c.position,
      company: c.company,
      country: e.location ? normalizeCountry(e.location) : null,
      summary: e.summary,
      skills: e.skills,
      industry: e.industry,
      experience: e.experience,
    });
    return { c, e, text };
  });

  console.log(`Embedding ${rows.length} profiles...`);
  const vectors = await embedTexts(rows.map((r) => r.text));

  const records = rows.map(({ c, e }, i) => ({
    user_id: userId,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    company: c.company,
    position: c.position,
    connected_on: c.connectedOn,
    linkedin_url: c.linkedinUrl,
    location: e.location ?? null,
    country: e.location ? normalizeCountry(e.location) : null,
    summary: e.summary ?? null,
    skills: e.skills ?? null,
    industry: e.industry ?? null,
    seniority: inferSeniority(c.position),
    company_norm: normalizeCompany(c.company),
    country_norm: e.location ? normalizeCountry(e.location) : null,
    enrichment_status: "enriched",
    enriched_at: new Date().toISOString(),
    embedding: vectors[i] ? toVectorLiteral(vectors[i]!) : null,
  }));

  const supa = createAdminClient();

  // Idempotent reload: clear this user's connections first.
  const { error: delErr } = await supa.from("connections").delete().eq("user_id", userId);
  if (delErr) throw new Error(`delete failed: ${delErr.message}`);

  let inserted = 0;
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await supa.from("connections").insert(batch);
    if (error) throw new Error(`insert failed at ${i}: ${error.message}`);
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${records.length}`);
  }

  console.log(`\n✅ Enriched & stored ${inserted} connections for ${userId}\n`);
}

main().catch((e) => {
  console.error("\n❌ enrich failed:", e.message, "\n");
  process.exit(1);
});

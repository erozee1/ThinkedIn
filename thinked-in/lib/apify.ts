import { ApifyClient } from "apify-client";
import { requireEnv } from "./supabase/env";

// Two distinct actors: one for profile enrichment, one for live post/activity scraping.
// Default to the cookieless dev_fusion profile scraper (input: profileUrls[] only).
const PROFILE_ACTOR = () => process.env.APIFY_PROFILE_ACTOR || "2SyF0bVxmgGr8IVCZ";
const ACTIVITY_ACTOR = () => requireEnv("APIFY_ACTIVITY_ACTOR");

let client: ApifyClient | null = null;
function apify(): ApifyClient {
  if (!client) client = new ApifyClient({ token: requireEnv("APIFY_TOKEN") });
  return client;
}

/**
 * Run an actor to completion and return its dataset items.
 * `input` is passed through verbatim so we can adapt to whichever actor/cookie
 * config is needed without changing this wrapper.
 */
async function runActor(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const run = await apify().actor(actorId).call(input);
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  return items as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Cost guard: Apify charges per profile scraped. We cap enrichment at 10
// profiles per user while the product is in early development / demo mode.
// Raise this once billing is confirmed and you've stress-tested the actor
// costs in production. This limit is enforced here (the single call-site) so
// it applies to both the online upload pipeline and offline scripts.
// ---------------------------------------------------------------------------
const ENRICH_LIMIT_PER_USER = 10;

/** Enrich a batch of LinkedIn profile URLs (offline enrichment).
 *  Input is silently capped at ENRICH_LIMIT_PER_USER to control Apify costs. */
export function scrapeProfiles(
  urls: string[],
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  const capped = urls.slice(0, ENRICH_LIMIT_PER_USER);
  if (capped.length < urls.length) {
    console.warn(`[APIFY] scrapeProfiles: capped ${urls.length} → ${capped.length} (ENRICH_LIMIT_PER_USER=${ENRICH_LIMIT_PER_USER})`);
  }
  return runActor(PROFILE_ACTOR(), { profileUrls: capped, urls: capped, ...extra });
}

/** Scrape one profile's recent posts/activity (live deep dive, Phase 6). */
export function scrapeActivity(
  linkedinUrl: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  return runActor(ACTIVITY_ACTOR(), { profileUrl: linkedinUrl, urls: [linkedinUrl], ...extra });
}

/** Normalized live snapshot of a single profile (premium verification). */
export interface LiveProfile {
  fullName: string | null;
  headline: string | null;
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
}

/**
 * Re-scrape ONE profile to confirm it's current. Used by the premium
 * verify_profiles tool to catch roles that changed since the CSV import.
 * Returns null if the actor yields nothing. Actor output keys vary, so we
 * defensively pull from the common variants.
 */
export async function verifyProfile(url: string): Promise<LiveProfile | null> {
  const items = await runActor(PROFILE_ACTOR(), { profileUrls: [url], urls: [url] });
  const p = items[0];
  if (!p) return null;
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = p[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  return {
    fullName: pick("fullName", "name", "fullname"),
    headline: pick("headline", "occupation", "subtitle"),
    jobTitle: pick("jobTitle", "position", "title", "currentJobTitle"),
    companyName: pick("companyName", "company", "currentCompany", "companyName1"),
    location: pick("location", "addressWithCountry", "geoLocationName", "addressWithoutCountry"),
  };
}

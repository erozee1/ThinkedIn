import { ApifyClient } from "apify-client";
import { requireEnv } from "./supabase/env";

// Two distinct actors: one for profile enrichment, one for live post/activity scraping.
const PROFILE_ACTOR = () => process.env.APIFY_PROFILE_ACTOR || "curious_coder/linkedin-profile-scraper";
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

/** Enrich a batch of LinkedIn profile URLs (offline enrichment). */
export function scrapeProfiles(
  urls: string[],
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  return runActor(PROFILE_ACTOR(), { profileUrls: urls, urls, ...extra });
}

/** Scrape one profile's recent posts/activity (live deep dive, Phase 6). */
export function scrapeActivity(
  linkedinUrl: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  return runActor(ACTIVITY_ACTOR(), { profileUrl: linkedinUrl, urls: [linkedinUrl], ...extra });
}

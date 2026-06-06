import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne, toVectorLiteral } from "../embeddings";

// Every function takes userIds (all Clerk user ids to query) and scopes all
// queries to that set explicitly (service-role client). For solo users this is
// [userId]; for org members it includes all org member ids. Filters are fuzzy
// by design (normalized columns + ilike) so they don't silently return zero rows.

export interface ConnectionRow {
  id: string;
  user_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  company: string | null;
  location: string | null;
  country: string | null;
  seniority: string | null;
  industry: string | null;
  summary: string | null;
  linkedin_url: string | null;
  relationship_strength: string | null;
  last_contacted: string | null;
  message_count?: number | null;
}

export interface Filters {
  country?: string;
  city?: string;
  seniority?: string;
  industry?: string;
  company?: string;
  relationship_strength?: string;
  last_contacted_after?: string;
  min_message_count?: number;
}

/** Whether a filter set touches an enriched profile field (vs. pure relationship). */
function usesProfileFilter(f: Filters): boolean {
  return Boolean(f.country || f.city || f.seniority || f.industry || f.company);
}

export async function searchByMeaning(
  supa: SupabaseClient,
  userIds: string[],
  query: string,
  filters: Filters = {},
  limit = 20,
): Promise<ConnectionRow[]> {
  const vector = await embedOne(query);
  const { data, error } = await supa.rpc("match_connections", {
    p_user_ids: userIds,
    query_embedding: toVectorLiteral(vector),
    match_count: limit,
    filter_country: filters.country ?? null,
    filter_company: filters.company ?? null,
    filter_seniority: filters.seniority ?? null,
    filter_industry: filters.industry ?? null,
    filter_relationship: filters.relationship_strength ?? null,
    filter_min_messages: filters.min_message_count ?? null,
  });
  if (error) throw new Error(`searchByMeaning: ${error.message}`);
  return (data ?? []) as ConnectionRow[];
}

const CONN_COLS =
  "id, first_name, last_name, position, company, location, country, seniority, industry, summary, linkedin_url, relationship_strength, last_contacted, message_count";

function applyFilters<T>(q: T, f: Filters, userIds: string[]): T {
  // q is a PostgREST filter builder; chained calls return the same builder.
  let b = (q as any).in("user_id", userIds);
  if (usesProfileFilter(f)) b = b.eq("enrichment_status", "enriched");
  if (f.country) b = b.eq("country_norm", f.country.toLowerCase());
  if (f.company) b = b.ilike("company_norm", `%${f.company.toLowerCase()}%`);
  if (f.city) b = b.ilike("city", `%${f.city}%`);
  if (f.seniority) b = b.eq("seniority", f.seniority);
  if (f.industry) b = b.ilike("industry", `%${f.industry}%`);
  if (f.relationship_strength) b = b.eq("relationship_strength", f.relationship_strength);
  if (f.last_contacted_after) b = b.gte("last_contacted", f.last_contacted_after);
  if (typeof f.min_message_count === "number") b = b.gte("message_count", f.min_message_count);
  return b as T;
}

export async function queryByFilter(
  supa: SupabaseClient,
  userIds: string[],
  filters: Filters,
  mode: "count" | "list",
  limit = 40,
): Promise<{ count: number } | ConnectionRow[]> {
  if (mode === "count") {
    const base = supa.from("connections").select("id", { count: "exact", head: true });
    const { count, error } = await applyFilters(base, filters, userIds);
    if (error) throw new Error(`queryByFilter(count): ${error.message}`);
    return { count: count ?? 0 };
  }
  const base = supa.from("connections").select(CONN_COLS).limit(limit);
  const { data, error } = await applyFilters(base, filters, userIds);
  if (error) throw new Error(`queryByFilter(list): ${error.message}`);
  return (data ?? []) as ConnectionRow[];
}

export async function getNetworkStats(
  supa: SupabaseClient,
  userIds: string[],
  groupBy: "industry" | "country" | "seniority" | "relationship_strength" = "industry",
): Promise<{ coverage: Record<string, number>; groups: { bucket: string; n: number }[] }> {
  // Coverage line (always).
  const status = ["enriched", "pending", "failed"] as const;
  const coverage: Record<string, number> = { total: 0, enriched: 0, pending: 0, failed: 0 };
  for (const s of status) {
    const { count } = await supa
      .from("connections")
      .select("id", { count: "exact", head: true })
      .in("user_id", userIds)
      .eq("enrichment_status", s);
    coverage[s] = count ?? 0;
  }
  coverage.total = coverage.enriched + coverage.pending + coverage.failed;

  // Grouping. relationship_strength counts ALL rows; profile fields count enriched only.
  const col = groupBy === "country" ? "country_norm" : groupBy;
  let q = supa.from("connections").select(col).in("user_id", userIds);
  if (groupBy !== "relationship_strength") q = q.eq("enrichment_status", "enriched");
  const { data, error } = await q;
  if (error) throw new Error(`getNetworkStats: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Record<string, string | null>[]) {
    const bucket = row[col] ?? "none";
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const groups = [...counts.entries()]
    .map(([bucket, n]) => ({ bucket, n }))
    .sort((a, b) => b.n - a.n);
  return { coverage, groups };
}

export async function keywordSearch(
  supa: SupabaseClient,
  userIds: string[],
  terms: string[],
  fields: ("position" | "company" | "summary" | "skills")[] = ["position", "company", "summary", "skills"],
  limit = 40,
): Promise<ConnectionRow[]> {
  // Build an OR across (field ilike %term%) for every field/term pair.
  const ors: string[] = [];
  for (const t of terms) {
    const safe = t.replace(/[%,()]/g, " ").trim();
    if (!safe) continue;
    for (const f of fields) {
      if (f === "skills") ors.push(`skills.cs.{${safe}}`); // array contains
      else ors.push(`${f}.ilike.%${safe}%`);
    }
  }
  if (!ors.length) return [];
  const { data, error } = await supa
    .from("connections")
    .select(CONN_COLS)
    .in("user_id", userIds)
    .eq("enrichment_status", "enriched")
    .or(ors.join(","))
    .limit(limit);
  if (error) throw new Error(`keywordSearch: ${error.message}`);
  return (data ?? []) as ConnectionRow[];
}

export interface MessageHit {
  subject: string | null;
  content: string | null;
  direction: string | null;
  sent_at: string | null;
  partner_name: string | null;
  connection_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  linkedin_url: string | null;
}

export async function searchMessages(
  supa: SupabaseClient,
  userId: string,
  query: string,
  limit = 20,
): Promise<MessageHit[]> {
  const vector = await embedOne(query);
  const { data, error } = await supa.rpc("match_messages", {
    p_user_id: userId,
    query_embedding: toVectorLiteral(vector),
    match_count: limit,
  });
  if (error) throw new Error(`searchMessages: ${error.message}`);
  return (data ?? []) as MessageHit[];
}

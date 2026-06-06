import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  searchByMeaning,
  queryByFilter,
  getNetworkStats,
  keywordSearch,
  searchMessages,
  type ConnectionRow,
  type Filters,
} from "./retrieval";
import { toCard } from "./cards";
import { mubitRemember, mubitRecordSuggestions } from "../mubit";
import { verifyProfile } from "../apify";
import type { ProfileCardData, ProfileVerification } from "../types";

export type MessagesMode = "full" | "metadata" | "none";

const FILTER_PROPS = {
  country: { type: "string", description: "Canonical country, e.g. 'united kingdom'. UK/England all map here." },
  city: { type: "string" },
  seniority: { type: "string", enum: ["founder", "c-suite", "vp", "director", "manager", "ic"] },
  industry: { type: "string" },
  company: { type: "string", description: "Company name; matched fuzzily." },
} as const;

const REL_FILTER_PROPS = {
  relationship_strength: { type: "string", enum: ["close", "active", "warm", "dormant", "none"] },
  last_contacted_after: { type: "string", description: "ISO date." },
  min_message_count: { type: "integer" },
} as const;

/** Build the Anthropic tool list for the user's messages mode.
 *  `premium` unlocks live Apify verification (re-scraping picks' profiles). */
export function toolsForMode(mode: MessagesMode, premium = false): Anthropic.Tool[] {
  const relAllowed = mode !== "none";
  const filterProps = relAllowed ? { ...FILTER_PROPS, ...REL_FILTER_PROPS } : FILTER_PROPS;

  const tools: Anthropic.Tool[] = [
    {
      name: "search_by_meaning",
      description:
        "Semantic search for people matching a DESCRIPTION of the ideal candidate (your words, " +
        "not the user's raw sentence). Use for 'find someone who…' / goal-implies-a-person queries. " +
        "Over-fetch (limit 30-40) then judge. Results are for YOUR reasoning only — " +
        "call present_connections with your final picks to show cards to the user.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Your description of the ideal person to find." },
          filters: { type: "object", properties: filterProps },
          limit: { type: "integer" },
        },
        required: ["query"],
      },
    },
    {
      name: "query_by_filter",
      description:
        "Exact counts/lists by attribute. mode='count' returns an exact number over the whole network. " +
        "Use for 'how many…', 'list all…', 'who works at X', 'who do I know well'. " +
        (relAllowed ? "Relationship filters available. " : "") +
        "For 'list' mode, call present_connections with your final picks after filtering.",
      input_schema: {
        type: "object",
        properties: {
          filters: { type: "object", properties: filterProps },
          mode: { type: "string", enum: ["count", "list"] },
          limit: { type: "integer" },
        },
        required: ["filters", "mode"],
      },
    },
    {
      name: "get_network_stats",
      description:
        "Aggregate the whole network by a dimension (returns counts per group + enrichment coverage). " +
        "Use for 'summarize my network', 'what industries am I strong in'" +
        (relAllowed ? ", 'how much of my network do I keep in touch with'." : "."),
      input_schema: {
        type: "object",
        properties: {
          group_by: {
            type: "string",
            enum: relAllowed
              ? ["industry", "country", "seniority", "relationship_strength"]
              : ["industry", "country", "seniority"],
          },
        },
      },
    },
    {
      name: "keyword_search",
      description:
        "Lexical search for a SPECIFIC word (niche skill, named tool, exact title) that semantic search " +
        "might miss. Complements search_by_meaning — run both and merge when a query has a concrete keyword. " +
        "Results are for YOUR reasoning only — call present_connections with your final picks.",
      input_schema: {
        type: "object",
        properties: {
          terms: { type: "array", items: { type: "string" } },
          fields: { type: "array", items: { type: "string", enum: ["position", "company", "summary", "skills"] } },
          limit: { type: "integer" },
        },
        required: ["terms"],
      },
    },
    {
      name: "save_goal",
      description:
        "Persist a goal or objective the user has stated (e.g. 'find a co-founder', 'get VC introductions', " +
        "'land a job in climate tech'). Call this the FIRST TIME a user states what they are trying to " +
        "accomplish. Goals persist across sessions and shape future suggestions. Do not call this for " +
        "one-off queries — only for stated ongoing objectives.",
      input_schema: {
        type: "object",
        properties: {
          goal: { type: "string", description: "The user's stated goal, in their own words." },
        },
        required: ["goal"],
      },
    },
    {
      name: "present_connections",
      description:
        "Show profile cards to the user in the UI. Call this ONCE at the end with only the people " +
        "you are actually recommending — typically 1–5. Do NOT pass everyone you searched; only the best fits.",
      input_schema: {
        type: "object",
        properties: {
          linkedin_urls: {
            type: "array",
            items: { type: "string" },
            description: "LinkedIn URLs of the connections to present, from the search results.",
          },
        },
        required: ["linkedin_urls"],
      },
    },
  ];

  if (premium) {
    tools.push({
      name: "verify_profiles",
      description:
        "PREMIUM. Re-scrape up to 3 of your TOP picks' live LinkedIn profiles to confirm they're still " +
        "current — titles and companies drift after the user's CSV export. Call this AFTER you've narrowed " +
        "to your best 1–3 people and BEFORE present_connections. Each result tells you whether the live role " +
        "still matches our record ('match') or has changed ('stale'). Mention any change in your answer " +
        "(e.g. 'heads up — she's since moved to Stripe'). Costs apply per profile, so only verify people you " +
        "are actually about to recommend.",
      input_schema: {
        type: "object",
        properties: {
          linkedin_urls: {
            type: "array",
            items: { type: "string" },
            description: "1–3 LinkedIn URLs of your top picks to verify (extras are ignored).",
          },
        },
        required: ["linkedin_urls"],
      },
    });
  }

  if (mode === "full") {
    tools.push({
      name: "search_messages",
      description:
        "Semantic search over the user's MESSAGE history (what was discussed), joined to the connection. " +
        "Use when the question is about what was said/discussed, not just who someone is.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Description of the topic to find." },
          limit: { type: "integer" },
        },
        required: ["query"],
      },
    });
  }
  return tools;
}

export interface ToolContext {
  supa: SupabaseClient;
  /** Clerk-verified user id; every query is scoped to it. */
  userId: string;
  /** Accumulates people surfaced by any tool, for the UI 'matches' cards. */
  collectCards: (cards: ProfileCardData[]) => void;
  /** True when the user is on the premium plan — unlocks verify_profiles. */
  premium: boolean;
  /** Verification results keyed by linkedin_url, stamped onto cards at present time. */
  verifications: Map<string, ProfileVerification>;
}

/** Cap on live verifications per query — Apify bills per profile. */
const VERIFY_LIMIT = 3;

/** True when the live role still lines up with what we have on record. */
function rolesAgree(storedPosition: string | null, storedCompany: string | null, live: { jobTitle: string | null; companyName: string | null; headline: string | null }): boolean {
  const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const liveText = norm([live.jobTitle, live.companyName, live.headline].filter(Boolean).join(" "));
  if (!liveText) return false;
  const company = norm(storedCompany);
  const position = norm(storedPosition);
  // Agree if the live profile still mentions the recorded company (most robust signal),
  // or the recorded job title when we have no company to anchor on.
  if (company && liveText.includes(company)) return true;
  if (!company && position && liveText.includes(position.split(" ").slice(0, 2).join(" "))) return true;
  return false;
}

/** Execute one tool call; returns a compact JSON-able result for the model. */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const { supa, userId, collectCards } = ctx;

  switch (name) {
    case "save_goal": {
      const goal = String(input.goal ?? "").trim();
      if (!goal) return { error: "goal is required" };
      await supa.from("user_goals").insert({ user_id: userId, goal });
      await mubitRemember(userId, `User goal: ${goal}`);
      return { saved: true };
    }
    case "search_by_meaning": {
      const rows = await searchByMeaning(
        supa,
        userId,
        String(input.query ?? ""),
        (input.filters as Filters) ?? {},
        typeof input.limit === "number" ? input.limit : 30,
      );
      // No collectCards here — model reasons over these, then calls present_connections.
      return rows.map(summarizeRow);
    }
    case "query_by_filter": {
      const mode = input.mode === "count" ? "count" : "list";
      const res = await queryByFilter(
        supa,
        userId,
        (input.filters as Filters) ?? {},
        mode,
        typeof input.limit === "number" ? input.limit : 40,
      );
      if (Array.isArray(res)) {
        // No collectCards here — model picks from this list then calls present_connections.
        return res.map(summarizeRow);
      }
      return res; // { count }
    }
    case "get_network_stats": {
      const g = (input.group_by as "industry" | "country" | "seniority" | "relationship_strength") ?? "industry";
      return getNetworkStats(supa, userId, g);
    }
    case "keyword_search": {
      const rows = await keywordSearch(
        supa,
        userId,
        (input.terms as string[]) ?? [],
        (input.fields as ("position" | "company" | "summary" | "skills")[]) ?? undefined,
        typeof input.limit === "number" ? input.limit : 40,
      );
      // No collectCards here — model picks from this list then calls present_connections.
      return rows.map(summarizeRow);
    }
    case "present_connections": {
      const urls = (input.linkedin_urls as string[]) ?? [];
      const { data } = await supa
        .from("connections")
        .select("id, first_name, last_name, position, company, location, country, seniority, industry, summary, linkedin_url, relationship_strength, last_contacted")
        .eq("user_id", userId)
        .in("linkedin_url", urls);
      const rows = (data ?? []) as ConnectionRow[];
      collectCards(
        rows.map((r) => {
          const card = toCard(r);
          const v = ctx.verifications.get(r.linkedin_url ?? "");
          return v ? { ...card, verified: v } : card;
        }),
      );

      // Record each suggestion for outreach tracking and the promise-loop memory.
      if (rows.length) {
        const actions = rows.map((r) => ({
          user_id: userId,
          connection_id: r.id,
          linkedin_url: r.linkedin_url,
          action_type: "suggested",
        }));
        await supa.from("network_actions").insert(actions);

        const names = rows.map((r) => [r.first_name, r.last_name].filter(Boolean).join(" "));
        await mubitRecordSuggestions(userId, names);
      }
      return { presented: rows.length };
    }
    case "search_messages": {
      const hits = await searchMessages(supa, userId, String(input.query ?? ""), typeof input.limit === "number" ? input.limit : 20);
      // No collectCards here — model picks relevant hits then calls present_connections.
      return hits.map((h) => ({
        with: [h.first_name, h.last_name].filter(Boolean).join(" "),
        company: h.company,
        linkedin_url: h.linkedin_url,
        direction: h.direction,
        sent_at: h.sent_at,
        subject: h.subject,
        snippet: h.content?.slice(0, 280) ?? null,
      }));
    }
    case "verify_profiles": {
      if (!ctx.premium) {
        return { error: "verify_profiles requires a premium subscription." };
      }
      const urls = ((input.linkedin_urls as string[]) ?? [])
        .filter((u) => typeof u === "string" && u.trim())
        .slice(0, VERIFY_LIMIT);
      if (!urls.length) return { error: "linkedin_urls is required" };

      // Pull what we have on record for these people, to compare against the live scrape.
      const { data } = await supa
        .from("connections")
        .select("first_name, last_name, position, company, linkedin_url")
        .eq("user_id", userId)
        .in("linkedin_url", urls);
      const stored = new Map(
        ((data ?? []) as ConnectionRow[]).map((r) => [r.linkedin_url, r]),
      );

      const checkedAt = new Date().toISOString();
      const results = [];
      for (const url of urls) {
        const rec = stored.get(url);
        const recordedName = rec ? [rec.first_name, rec.last_name].filter(Boolean).join(" ") : null;
        let verification: ProfileVerification;
        try {
          const live = await verifyProfile(url);
          if (!live) {
            verification = { status: "unreachable", currentPosition: null, currentCompany: null, checkedAt };
          } else {
            const agree = rolesAgree(rec?.position ?? null, rec?.company ?? null, live);
            verification = {
              status: agree ? "match" : "stale",
              currentPosition: live.jobTitle ?? live.headline,
              currentCompany: live.companyName,
              checkedAt,
            };
          }
        } catch (e) {
          verification = { status: "unreachable", currentPosition: null, currentCompany: null, checkedAt };
          console.error("[VERIFY] failed for", url, e instanceof Error ? e.message : e);
        }
        ctx.verifications.set(url, verification);
        results.push({
          name: recordedName,
          linkedin_url: url,
          recorded_role: rec ? [rec.position, rec.company].filter(Boolean).join(" at ") : null,
          status: verification.status,
          live_position: verification.currentPosition,
          live_company: verification.currentCompany,
        });
      }
      return results;
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

/** Trim a row to what the model needs to reason + cite (keeps tokens down). */
function summarizeRow(r: ConnectionRow) {
  return {
    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    position: r.position,
    company: r.company,
    location: r.location ?? r.country,
    seniority: r.seniority,
    industry: r.industry,
    relationship: r.relationship_strength,
    last_contacted: r.last_contacted,
    summary: r.summary?.slice(0, 200) ?? null,
    linkedin_url: r.linkedin_url,
  };
}

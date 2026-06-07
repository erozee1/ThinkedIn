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
import { researchPerson } from "./research";
import type { ProfileCardData, ProfileVerification, LinkedInPostData } from "../types";

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
    {
      name: "present_web_post",
      description:
        "Surface a LinkedIn post, profile update, or article found via web_search as a styled card in the UI. " +
        "Call this WHENEVER web_search returns a LinkedIn URL that belongs to a person (post, activity, profile). " +
        "You do NOT need full post content — call it with whatever the search result gave you: the title as content, " +
        "the URL as source_url, and the person's name. Partial data is fine; the card still renders. " +
        "Especially useful for: recent promotions, job changes, articles, company updates. " +
        "Call once per relevant result — do not skip just because the data is incomplete.",
      input_schema: {
        type: "object",
        properties: {
          author_name: { type: "string", description: "Full name of the post author." },
          author_title: { type: "string", description: "Author's job title / headline." },
          author_avatar_url: { type: "string", description: "URL to author's profile photo if available." },
          content: { type: "string", description: "The post text or article excerpt (first 400 chars is enough)." },
          source_url: { type: "string", description: "URL to the original post or article." },
          image_url: { type: "string", description: "URL of the post's image if present." },
          time_ago: { type: "string", description: "How long ago it was posted, e.g. '3d', '1w', '2mo'." },
          likes_count: { type: "integer", description: "Number of reactions/likes." },
          comments_count: { type: "integer", description: "Number of comments." },
        },
        required: ["author_name", "content", "source_url"],
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

  // Only expose research_person when a Tavily key is available.
  if (process.env.TAVILY_API_KEY) {
    tools.push({
      name: "research_person",
      description:
        "Deep-dive research on a specific connection: pulls their recent news coverage, blog posts and articles, " +
        "GitHub / open-source work, and talk or podcast appearances from the public web. " +
        "Call this AFTER narrowing to a shortlist (1–3 people) when you need external evidence to " +
        "choose who to recommend or to give the user a richer 'why this person' answer. " +
        "DO NOT call it during initial broad searches — only for people you are seriously considering. " +
        "Use the findings to cite real, specific things: a recent post, a project, a talk topic.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name of the person." },
          company: { type: "string", description: "Their current company (improves search precision)." },
          role: { type: "string", description: "Their title or area of work (optional)." },
        },
        required: ["name"],
      },
    });
  }

  return tools;
}

export interface ToolContext {
  supa: SupabaseClient;
  /** Clerk-verified user id of the requester — used for writes only. */
  userId: string;
  /** All queryable user ids: [userId] for solo, org member ids for org users. */
  userIds: string[];
  /** Name + avatar for each org member — populates viaName/viaAvatarUrl on team cards. */
  teamMembers?: Record<string, { name: string; avatarUrl: string }>;
  /** Accumulates people surfaced by any tool, for the UI 'matches' cards. */
  collectCards: (cards: ProfileCardData[]) => void;
  /** True when the user is on the premium plan — unlocks verify_profiles. */
  premium: boolean;
  /** Verification results keyed by linkedin_url, stamped onto cards at present time. */
  verifications: Map<string, ProfileVerification>;
  /** Accumulates LinkedIn posts surfaced via present_web_post. */
  collectLinkedInPosts?: (posts: LinkedInPostData[]) => void;
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
  const { supa, userId, userIds, collectCards } = ctx;

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
        userIds,
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
        userIds,
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
      return getNetworkStats(supa, userIds, g);
    }
    case "keyword_search": {
      const rows = await keywordSearch(
        supa,
        userIds,
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
        .select("id, user_id, first_name, last_name, position, company, location, country, seniority, industry, summary, linkedin_url, relationship_strength, last_contacted")
        .in("user_id", userIds)
        .in("linkedin_url", urls);
      const rows = (data ?? []) as ConnectionRow[];
      collectCards(
        rows.map((r) => {
          const isTeam = r.user_id !== userId;
          const tm = isTeam ? ctx.teamMembers?.[r.user_id ?? ""] : undefined;
          const card: ProfileCardData = {
            ...toCard(r),
            fromTeam: isTeam,
            relationshipStrength: r.relationship_strength ?? undefined,
            lastContacted: r.last_contacted ?? null,
            viaName: tm?.name,
            viaAvatarUrl: tm?.avatarUrl,
          };
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
    case "present_web_post": {
      const post: LinkedInPostData = {
        authorName: String(input.author_name ?? ""),
        authorTitle: input.author_title ? String(input.author_title) : undefined,
        authorAvatarUrl: input.author_avatar_url ? String(input.author_avatar_url) : undefined,
        content: String(input.content ?? ""),
        sourceUrl: input.source_url ? String(input.source_url) : undefined,
        imageUrl: input.image_url ? String(input.image_url) : undefined,
        timeAgo: input.time_ago ? String(input.time_ago) : undefined,
        likesCount: typeof input.likes_count === "number" ? input.likes_count : undefined,
        commentsCount: typeof input.comments_count === "number" ? input.comments_count : undefined,
      };
      ctx.collectLinkedInPosts?.([post]);
      return { presented: true };
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
    case "research_person": {
      const brief = await researchPerson({
        name: String(input.name ?? ""),
        company: input.company ? String(input.company) : undefined,
        role: input.role ? String(input.role) : undefined,
      });
      if (!brief.available) {
        return { error: "research_person unavailable — use web_search directly instead." };
      }
      return brief;
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
    owner_user_id: r.user_id ?? null,
  };
}

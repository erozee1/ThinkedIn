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
import { researchPerson } from "./research";
import type { ProfileCardData, LinkedInPostData } from "../types";

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

/** Build the Anthropic tool list for the user's messages mode. */
export function toolsForMode(mode: MessagesMode): Anthropic.Tool[] {
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
  /** Accumulates LinkedIn posts surfaced via present_web_post. */
  collectLinkedInPosts?: (posts: LinkedInPostData[]) => void;
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
      collectCards(rows.map((r) => {
        const isTeam = r.user_id !== userId;
        const tm = isTeam ? ctx.teamMembers?.[r.user_id ?? ""] : undefined;
        return {
          ...toCard(r),
          fromTeam: isTeam,
          relationshipStrength: r.relationship_strength ?? undefined,
          lastContacted: r.last_contacted ?? null,
          viaName: tm?.name,
          viaAvatarUrl: tm?.avatarUrl,
        };
      }));

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

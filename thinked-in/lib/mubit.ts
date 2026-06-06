import { Client } from "@mubit-ai/sdk";

const AGENT_ID = "thinked-in";
let _client: Client | null = null;

function client() {
  if (!_client) {
    _client = new Client({ api_key: process.env.MUBIT_API_KEY, transport: "http" });
  }
  return _client;
}

function enabled() {
  return Boolean(process.env.MUBIT_API_KEY);
}

/**
 * Commit a user goal to long-term memory.
 * Called when the agent's save_goal tool fires.
 */
export async function mubitRemember(userId: string, content: string) {
  if (!enabled()) return;
  try {
    await client().remember({ session_id: userId, agent_id: AGENT_ID, content, intent: "commit" });
  } catch (e) {
    console.error("[MUBIT] remember failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Semantic recall — returns past goals and previous suggestion outcomes
 * relevant to the current query. This is the temporal serendipity layer:
 * archived intent from previous sessions collides with what the user is asking now.
 */
export async function mubitRecall(userId: string, query: string): Promise<string> {
  if (!enabled()) return "";
  try {
    const r = await client().recall({ session_id: userId, agent_id: AGENT_ID, query });
    if (typeof r === "string") return r;
    if (r && typeof r === "object" && !Array.isArray(r)) {
      return (r as Record<string, unknown>).content as string ?? "";
    }
    return "";
  } catch (e) {
    console.error("[MUBIT] recall failed:", e instanceof Error ? e.message : e);
    return "";
  }
}

/**
 * Record who was suggested — closes the promise loop.
 * Next session, mubitRecall will surface "you suggested X last week, did you follow up?"
 */
export async function mubitRecordSuggestions(userId: string, names: string[]) {
  if (!enabled() || !names.length) return;
  try {
    await client().recordOutcome({
      session_id: userId,
      agent_id: AGENT_ID,
      reference_id: `suggestion-${Date.now()}`,
      outcome: `Suggested to user: ${names.join(", ")}`,
      rationale: "Agent recommended these connections based on user query",
    });
  } catch (e) {
    console.error("[MUBIT] recordOutcome failed:", e instanceof Error ? e.message : e);
  }
}

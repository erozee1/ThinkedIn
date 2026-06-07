import { Client } from "@mubit-ai/sdk";

const AGENT_ID = "thinked-in";
const DEBUG = process.env.MUBIT_DEBUG === "1" || process.env.NODE_ENV !== "production";
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
    if (DEBUG) console.log(`[MUBIT] remember ok (user=${userId}, ${content.length} chars)`);
  } catch (e) {
    console.error("[MUBIT] remember failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Normalize a recall response into plain text. The SDK's OperationResult can be
 * a string, an object ({ content } or { results: [...] }), an array of memory
 * entries, or a fetch-like response — handle each so memory never silently
 * disappears just because the wire shape differs from what we expected.
 */
async function normalizeRecall(r: unknown): Promise<string> {
  if (r == null) return "";
  if (typeof r === "string") return r;

  // Fetch-like response (has .json()/.text()) — unwrap then recurse.
  if (typeof r === "object" && r !== null) {
    const maybeFetch = r as { json?: () => Promise<unknown>; text?: () => Promise<string> };
    if (typeof maybeFetch.json === "function") {
      try {
        return await normalizeRecall(await maybeFetch.json());
      } catch {
        if (typeof maybeFetch.text === "function") return (await maybeFetch.text()) ?? "";
      }
    }
  }

  if (Array.isArray(r)) {
    return r.map((item) => extractText(item)).filter(Boolean).join("\n");
  }

  if (typeof r === "object") {
    const obj = r as Record<string, unknown>;
    // Common container shapes: { results: [...] }, { memories: [...] }, { items: [...] }.
    const list = obj.results ?? obj.memories ?? obj.items ?? obj.entries;
    if (Array.isArray(list)) return list.map((item) => extractText(item)).filter(Boolean).join("\n");
    return extractText(obj);
  }

  return "";
}

/** Pull a human-readable string out of a single memory entry of unknown shape. */
function extractText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const v = o.content ?? o.text ?? o.value ?? o.memory ?? o.summary;
    if (typeof v === "string") return v;
  }
  return "";
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
    const text = await normalizeRecall(r);
    if (DEBUG) {
      console.log(
        `[MUBIT] recall ok (user=${userId}): ${text ? `${text.length} chars` : "no memory"} ` +
          `[raw type: ${Array.isArray(r) ? "array" : typeof r}]`,
      );
    }
    return text;
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
    if (DEBUG) console.log(`[MUBIT] recordOutcome ok (user=${userId}, ${names.length} names)`);
  } catch (e) {
    console.error("[MUBIT] recordOutcome failed:", e instanceof Error ? e.message : e);
  }
}

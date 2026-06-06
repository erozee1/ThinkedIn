import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toolsForMode, runTool, type MessagesMode, type ToolContext } from "./tools";
import { systemPrompt } from "./prompt";
import { dedupeCards } from "./cards";
import type { ProfileCardData, ToolCallInfo } from "../types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_STEPS = 6;

export interface AgentTurnInput {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentOptions {
  supa: SupabaseClient;
  /** Clerk-verified user id of the requester. */
  userId: string;
  /** All queryable user ids: [userId] for solo users, org member ids for org users. */
  userIds?: string[];
  mode: MessagesMode;
  /** Injected goal + recall context from Mubit + Supabase — prepended to the system prompt. */
  goalContext?: string;
  /** Number of org members (>1 activates org-aware system prompt). */
  orgSize?: number;
  message: string;
  history?: AgentTurnInput[];
  /** Called at the start of each model turn so the client can create a new message bubble. */
  onTurnStart?: () => void;
  /** Called at the end of each model turn. tools is non-empty for intermediate tool-call turns. */
  onTurnEnd?: (tools: ToolCallInfo[]) => void;
  /** Called with each streamed text token. */
  onText: (text: string) => void;
  /** Called with the cumulative, deduped list of surfaced people. */
  onMatches: (matches: ProfileCardData[]) => void;
  /** Called when the agent invokes a tool (before it runs) — for progress UI. */
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  /** Called after a tool returns, with a short result count/summary. */
  onToolResult?: (name: string, resultCount: number | null) => void;
  anthropic?: Anthropic;
}

/**
 * Drives the Claude tool-use loop over the user's network. Shared by the chat
 * route (streams to the client) and the CLI test harness (prints to console).
 */
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
};

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const anthropic = opts.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools: (Anthropic.Tool | Anthropic.WebSearchTool20250305)[] = [
    WEB_SEARCH_TOOL,
    ...toolsForMode(opts.mode),
  ];
  const system = systemPrompt(opts.mode, opts.goalContext, opts.orgSize);

  const collected: ProfileCardData[] = [];
  const ctx: ToolContext = {
    supa: opts.supa,
    userId: opts.userId,
    userIds: opts.userIds ?? [opts.userId],
    collectCards: (cards) => collected.push(...cards),
  };

  const messages: Anthropic.MessageParam[] = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: opts.message },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    opts.onTurnStart?.();

    const turn = anthropic.messages.stream({ model: MODEL, max_tokens: 2000, system, tools, messages });
    turn.on("text", (t) => opts.onText(t));
    const msg = await turn.finalMessage();

    const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const serverToolUses = msg.content.filter((b): b is Anthropic.ServerToolUseBlock => b.type === "server_tool_use");

    // Collect per-tool info to forward to the client for richer UI.
    const toolInfos: ToolCallInfo[] = serverToolUses.map((tu) => ({
      name: tu.name,
      input: tu.input as Record<string, unknown>,
      resultCount: null,
    }));

    if (toolUses.length === 0) {
      opts.onTurnEnd?.(toolInfos); // server-tool-only turn or end turn
      break;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = tu.input as Record<string, unknown>;
      opts.onToolCall?.(tu.name, input);
      let out: unknown;
      try {
        out = await runTool(tu.name, input, ctx);
      } catch (e) {
        out = { error: e instanceof Error ? e.message : String(e) };
      }
      const resultCount =
        Array.isArray(out) ? out.length :
        out && typeof out === "object" && "count" in (out as object) ? (out as { count: number }).count :
        out && typeof out === "object" && "presented" in (out as object) ? (out as { presented: number }).presented :
        null;
      opts.onToolResult?.(tu.name, resultCount);
      toolInfos.push({ name: tu.name, input, resultCount });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }

    opts.onTurnEnd?.(toolInfos);

    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: results });
  }

  // Emit matches after the loop so they are attributed to the final answer turn,
  // not to a thinking step. This ensures profile cards appear alongside the text.
  if (collected.length) opts.onMatches(dedupeCards(collected));
}

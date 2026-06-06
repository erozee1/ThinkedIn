import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toolsForMode, runTool, type MessagesMode, type ToolContext } from "./tools";
import { systemPrompt } from "./prompt";
import { dedupeCards } from "./cards";
import type { ProfileCardData } from "../types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_STEPS = 6;

export interface AgentTurnInput {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentOptions {
  supa: SupabaseClient;
  /** Clerk-verified user id; all queries are scoped to it. */
  userId: string;
  mode: MessagesMode;
  /** Injected goal + recall context from Mubit + Supabase — prepended to the system prompt. */
  goalContext?: string;
  message: string;
  history?: AgentTurnInput[];
  /** Called at the start of each model turn so the client can create a new message bubble. */
  onTurnStart?: () => void;
  /** Called at the end of each model turn. toolNames is non-empty for intermediate tool-call turns. */
  onTurnEnd?: (toolNames: string[]) => void;
  /** Called with each streamed text token. */
  onText: (text: string) => void;
  /** Called with the cumulative, deduped list of surfaced people. */
  onMatches: (matches: ProfileCardData[]) => void;
  /** Called when the agent invokes a tool (before it runs) — for progress UI. */
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  /** Called after a tool returns, with a short result count/summary. */
  onToolResult?: (name: string, resultCount: number | null) => void;
  /** Premium subscriber — unlocks the live Apify verify_profiles tool. */
  premium?: boolean;
  anthropic?: Anthropic;
}

/**
 * Drives the Claude tool-use loop over the user's network. Shared by the chat
 * route (streams to the client) and the CLI test harness (prints to console).
 */
export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const anthropic = opts.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const premium = opts.premium ?? false;
  const tools = toolsForMode(opts.mode, premium);
  const system = systemPrompt(opts.mode, opts.goalContext, premium);

  const collected: ProfileCardData[] = [];
  const ctx: ToolContext = {
    supa: opts.supa,
    userId: opts.userId,
    collectCards: (cards) => collected.push(...cards),
    premium,
    verifications: new Map(),
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

    // Signal end of turn: pass tool names so the client can decide how to render it.
    opts.onTurnEnd?.(toolUses.map((t) => t.name));

    if (toolUses.length === 0) break; // end_turn — final answer already streamed

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
      const count = Array.isArray(out) ? out.length : null;
      opts.onToolResult?.(tu.name, count);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }

    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: results });
  }

  // Emit matches after the loop so they are attributed to the final answer turn,
  // not to a thinking step. This ensures profile cards appear alongside the text.
  if (collected.length) opts.onMatches(dedupeCards(collected));
}

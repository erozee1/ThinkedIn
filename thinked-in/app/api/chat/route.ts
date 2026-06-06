import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAgent, type AgentTurnInput } from "@/lib/agent/run";
import type { MessagesMode } from "@/lib/agent/tools";
import { mubitRecall } from "@/lib/mubit";

export const maxDuration = 60;

// Wire protocol (newline-delimited JSON):
//   {"type":"turn_start"}                       each agent turn begins → client creates a new bubble
//   {"type":"delta","text":"..."}               streamed text token for the current turn
//   {"type":"turn_end","tools":["tool_name"]}   current turn done; tools=[] means final answer
//   {"type":"matches","matches":[...]}          profile cards to attach to the current message
//
// Auth: userId comes from Clerk's server-verified session. Every DB query is
// scoped to it explicitly (service-role client), so data is isolated per user.
export async function POST(request: NextRequest) {
  const { userId, has } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Premium plan unlocks live Apify profile verification in the agent.
  const premium = typeof has === "function" ? has({ plan: "premium" }) : false;

  let message = "";
  let history: AgentTurnInput[] = [];
  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message : "";
    if (Array.isArray(body?.history)) history = body.history;
  } catch {
    /* empty handled below */
  }

  const supa = createAdminClient();
  const { data: settings } = await supa
    .from("user_settings")
    .select("messages_mode")
    .eq("user_id", userId)
    .maybeSingle();
  const mode = (settings?.messages_mode ?? "none") as MessagesMode;

  // Build goal context: Supabase (structured) + Mubit (semantic recall).
  // Both run in parallel to keep latency down.
  const [{ data: goals }, mubitContext] = await Promise.all([
    supa
      .from("user_goals")
      .select("goal")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(5),
    mubitRecall(userId, message),
  ]);

  const goalLines = goals?.map((g: { goal: string }) => `- ${g.goal}`).join("\n") ?? "";
  const goalContext =
    [goalLines && `Goals:\n${goalLines}`, mubitContext && `Session memory:\n${mubitContext}`]
      .filter(Boolean)
      .join("\n\n") || undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        await runAgent({
          supa,
          userId,
          mode,
          premium,
          goalContext,
          message,
          history,
          onTurnStart: () => send({ type: "turn_start" }),
          onTurnEnd: (tools) => send({ type: "turn_end", tools }),
          onText: (text) => send({ type: "delta", text }),
          onMatches: (matches) => send({ type: "matches", matches }),
        });
      } catch (e) {
        send({
          type: "delta",
          text: "\n\n_(Sorry — I hit an error reaching your network: " + (e instanceof Error ? e.message : String(e)) + ")_",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { searchNetwork } from "@/lib/mock-search";

// STUB: streams a mocked Claude reply. Protocol = newline-delimited JSON:
//   {"type":"matches","matches":[...]}   (once, first)
//   {"type":"delta","text":"..."}        (many)
// The real version will do intent extraction, pgvector search, and stream a
// genuine Claude response — behind this same endpoint and protocol.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let message = "";
  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message : "";
  } catch {
    // empty message handled below
  }

  const { matches, reply } = searchNetwork(message);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      // Surface matched people first so the UI can render cards immediately.
      send({ type: "matches", matches });
      await new Promise((r) => setTimeout(r, 350));

      // Stream the reply token-by-token for a live "typing" feel.
      const tokens = reply.match(/\S+\s*/g) ?? [reply];
      for (const token of tokens) {
        send({ type: "delta", text: token });
        await new Promise((r) => setTimeout(r, 22));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

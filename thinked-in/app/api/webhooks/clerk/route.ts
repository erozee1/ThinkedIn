import type { NextRequest } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Verify and handle Clerk webhooks. Currently handles user.deleted to wipe
// all user data from Supabase. Register this URL in the Clerk dashboard under
// Webhooks, and set CLERK_WEBHOOK_SECRET to the signing secret shown there.
export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[WEBHOOK] CLERK_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await request.text();
  let event: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "user.deleted") {
    const userId = event.data.id as string | undefined;
    if (!userId) {
      return Response.json({ error: "Missing user id in payload" }, { status: 400 });
    }

    console.log(`[WEBHOOK] user.deleted — wiping data for user=${userId}`);
    const supa = createAdminClient();

    // Delete in dependency order. connections cascades to profile_research and
    // network_actions. messages.connection_id is SET NULL on cascade so we
    // delete messages explicitly by user_id.
    const tables = [
      "connections",     // cascades → profile_research, network_actions
      "messages",
      "user_settings",
      "upload_jobs",
      "user_goals",
    ] as const;

    for (const table of tables) {
      const { error } = await supa.from(table).delete().eq("user_id", userId);
      if (error) {
        // 42P01 = undefined_table — table may not exist yet in this environment, skip it.
        // Also check message string as PostgREST sometimes surfaces it differently.
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn(`[WEBHOOK] table ${table} does not exist yet — skipping`);
          continue;
        }
        console.error(`[WEBHOOK] failed to delete from ${table}: ${error.message}`);
        return Response.json({ error: `Failed to delete from ${table}` }, { status: 500 });
      }
      console.log(`[WEBHOOK] cleared ${table} for user=${userId}`);
    }

    console.log(`[WEBHOOK] user.deleted complete — all data wiped for user=${userId}`);
  }

  return Response.json({ received: true });
}

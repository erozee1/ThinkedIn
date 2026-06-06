import { type NextRequest, after } from "next/server";
import { strFromU8, unzipSync } from "fflate";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConnections } from "@/lib/data/connections";
import { processConnections, processMessages } from "@/lib/ingest/process";

export const runtime = "nodejs";
export const maxDuration = 300;

type Mode = "full" | "metadata" | "none";

// Pull Connections.csv (required) and messages.csv (optional) out of either a
// raw .csv upload or the LinkedIn export .zip. File is parsed in memory only.
function extractCsvs(name: string, bytes: Uint8Array): { connections: string | null; messages: string | null } {
  if (name.toLowerCase().endsWith(".zip")) {
    const files = unzipSync(bytes);
    let connections: string | null = null;
    let messages: string | null = null;
    for (const [path, data] of Object.entries(files)) {
      const base = path.split("/").pop()?.toLowerCase() ?? "";
      if (base === "connections.csv") connections = strFromU8(data);
      else if (base === "messages.csv") messages = strFromU8(data);
    }
    return { connections, messages };
  }
  // Single .csv — assume it's the connections export.
  return { connections: strFromU8(bytes), messages: null };
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  console.log(`[UPLOAD] start — user=${userId}`);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  const requestedMode = (form.get("messages_mode") as Mode | null) ?? null;
  console.log(`[UPLOAD] file="${file.name}" size=${file.size}B requested_mode=${requestedMode}`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  let connectionsCsv: string | null;
  let messagesCsv: string | null;
  try {
    ({ connections: connectionsCsv, messages: messagesCsv } = extractCsvs(file.name, bytes));
    console.log(`[UPLOAD] extracted — connections=${connectionsCsv ? `${connectionsCsv.length}B` : "null"} messages=${messagesCsv ? `${messagesCsv.length}B` : "null"}`);
  } catch (e) {
    console.error("[UPLOAD] extractCsvs failed:", e);
    return Response.json({ error: "Could not read the file. Upload the LinkedIn export .zip or Connections.csv." }, { status: 400 });
  }
  if (!connectionsCsv) {
    console.error("[UPLOAD] Connections.csv not found in zip");
    return Response.json({ error: "Connections.csv not found in the upload." }, { status: 400 });
  }

  let total = 0;
  try {
    total = parseConnections(connectionsCsv).length;
    console.log(`[UPLOAD] parsed ${total} connections`);
  } catch (e) {
    console.error("[UPLOAD] parseConnections failed:", e);
    return Response.json({ error: "Connections.csv could not be parsed." }, { status: 400 });
  }
  if (!total) return Response.json({ error: "No connections found in the file." }, { status: 400 });

  const mode: Mode = requestedMode ?? (messagesCsv ? "metadata" : "none");
  console.log(`[UPLOAD] mode=${mode}`);

  let supa;
  try {
    supa = createAdminClient();
    console.log("[UPLOAD] supabase admin client created");
  } catch (e) {
    console.error("[UPLOAD] createAdminClient failed:", e);
    return Response.json({ error: "Database configuration error" }, { status: 500 });
  }

  const { error: settingsErr } = await supa.from("user_settings").upsert(
    { user_id: userId, messages_mode: mode, consent_recorded_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (settingsErr) console.error("[UPLOAD] user_settings upsert error:", settingsErr.message);
  else console.log("[UPLOAD] user_settings upserted");

  const { data: job, error: jobErr } = await supa
    .from("upload_jobs")
    .insert({ user_id: userId, total_connections: total, enriched_count: 0, status: "processing" })
    .select("id")
    .single();
  if (jobErr || !job) {
    console.error("[UPLOAD] upload_jobs insert failed:", jobErr?.message);
    return Response.json({ error: `Could not start job: ${jobErr?.message}` }, { status: 500 });
  }
  console.log(`[UPLOAD] job created — id=${job.id}`);

  const connCsv = connectionsCsv;
  const msgCsv = messagesCsv;
  after(async () => {
    console.log(`[UPLOAD:BG] background task started — job=${job.id}`);
    try {
      await processConnections(supa, userId, connCsv, job.id);
      console.log(`[UPLOAD:BG] processConnections complete`);
      if (msgCsv && mode !== "none") {
        console.log(`[UPLOAD:BG] starting processMessages mode=${mode}`);
        await processMessages(supa, userId, msgCsv, mode);
        console.log(`[UPLOAD:BG] processMessages complete`);
      }
      await supa.from("upload_jobs").update({ status: "complete", enriched_count: total, updated_at: new Date().toISOString() }).eq("id", job.id);
      console.log(`[UPLOAD:BG] job marked complete`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[UPLOAD:BG] FAILED — job=${job.id} error="${msg}"`);
      if (e instanceof Error && e.stack) console.error("[UPLOAD:BG] stack:", e.stack);
      await supa.from("upload_jobs").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", job.id);
    }
  });

  console.log(`[UPLOAD] response sent — jobId=${job.id} total=${total}`);
  return Response.json({ jobId: job.id, totalConnections: total });
}

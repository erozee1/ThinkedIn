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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  const requestedMode = (form.get("messages_mode") as Mode | null) ?? null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  let connectionsCsv: string | null;
  let messagesCsv: string | null;
  try {
    ({ connections: connectionsCsv, messages: messagesCsv } = extractCsvs(file.name, bytes));
  } catch {
    return Response.json({ error: "Could not read the file. Upload the LinkedIn export .zip or Connections.csv." }, { status: 400 });
  }
  if (!connectionsCsv) {
    return Response.json({ error: "Connections.csv not found in the upload." }, { status: 400 });
  }

  // Count now so we can report total immediately (cheap parse).
  let total = 0;
  try { total = parseConnections(connectionsCsv).length; } catch {
    return Response.json({ error: "Connections.csv could not be parsed." }, { status: 400 });
  }
  if (!total) return Response.json({ error: "No connections found in the file." }, { status: 400 });

  // Consent: explicit field wins; else default to privacy-preserving 'metadata'
  // when messages are present, 'none' otherwise.
  const mode: Mode = requestedMode ?? (messagesCsv ? "metadata" : "none");

  const supa = createAdminClient();
  await supa.from("user_settings").upsert(
    { user_id: userId, messages_mode: mode, consent_recorded_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  const { data: job, error: jobErr } = await supa
    .from("upload_jobs")
    .insert({ user_id: userId, total_connections: total, enriched_count: 0, status: "processing" })
    .select("id")
    .single();
  if (jobErr || !job) {
    return Response.json({ error: `Could not start job: ${jobErr?.message}` }, { status: 500 });
  }

  // Heavy work continues after the response (within maxDuration). UI polls /api/enrich.
  const connCsv = connectionsCsv;
  const msgCsv = messagesCsv;
  after(async () => {
    try {
      await processConnections(supa, userId, connCsv, job.id);
      if (msgCsv && mode !== "none") {
        await processMessages(supa, userId, msgCsv, mode);
      }
      await supa.from("upload_jobs").update({ status: "complete", enriched_count: total, updated_at: new Date().toISOString() }).eq("id", job.id);
    } catch (e) {
      await supa.from("upload_jobs").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", job.id);
      console.error("upload processing failed:", e instanceof Error ? e.message : e);
    }
  });

  return Response.json({ jobId: job.id, totalConnections: total });
}

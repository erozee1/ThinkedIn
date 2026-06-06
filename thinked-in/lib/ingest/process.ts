import type { SupabaseClient } from "@supabase/supabase-js";
import { parseConnections, fullName } from "../data/connections";
import { parseMessages } from "../data/messages";
import { inferSeniority } from "../data/seniority";
import { normalizeCompany } from "../data/normalize";
import { buildProfileText } from "../data/profile-text";
import { relationshipStrength } from "../data/relationships";
import { normalizeLinkedInUrl } from "../data/url";
import { embedTexts, toVectorLiteral } from "../embeddings";
import type { ParsedMessage } from "../data/types";

// Shared upload-processing logic used by the /api/upload route (and reusable by
// offline scripts). All writes go through the passed service-role client and are
// scoped to userId. Progress is tracked on the upload_jobs row so the UI can poll.

async function bumpJob(supa: SupabaseClient, jobId: string, enriched: number, status?: string) {
  const patch: Record<string, unknown> = { enriched_count: enriched, updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  await supa.from("upload_jobs").update(patch).eq("id", jobId);
}

/**
 * Parse connections, insert baseline rows (CSV fields + seniority + normalized
 * company), embed each profile, and store. Sets enrichment_status='enriched'
 * (searchable) — Apify enrichment later only *adds* location/industry/photo.
 * Replaces any prior connections for this user (idempotent re-upload).
 */
export async function processConnections(
  supa: SupabaseClient,
  userId: string,
  connectionsCsv: string,
  jobId: string,
): Promise<number> {
  const connections = parseConnections(connectionsCsv);
  console.log(`[INGEST] processConnections start — ${connections.length} rows user=${userId} job=${jobId}`);

  const { error: delMsgErr } = await supa.from("messages").delete().eq("user_id", userId);
  if (delMsgErr) console.error("[INGEST] messages delete error:", delMsgErr.message);
  else console.log("[INGEST] existing messages cleared");

  const { error: delConnErr } = await supa.from("connections").delete().eq("user_id", userId);
  if (delConnErr) console.error("[INGEST] connections delete error:", delConnErr.message);
  else console.log("[INGEST] existing connections cleared");

  const BATCH = 100;
  let done = 0;
  for (let i = 0; i < connections.length; i += BATCH) {
    const slice = connections.slice(i, i + BATCH);
    console.log(`[INGEST] batch ${i}–${i + slice.length - 1}: embedding ${slice.length} profiles…`);

    let vectors: (number[] | null)[];
    try {
      const texts = slice.map((c) =>
        buildProfileText({ fullName: fullName(c), position: c.position, company: c.company }),
      );
      vectors = await embedTexts(texts);
      console.log(`[INGEST] batch ${i}: embeddings received (${vectors.filter(Boolean).length}/${slice.length} non-null)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[INGEST] batch ${i}: embedTexts FAILED — "${msg}"`);
      throw e;
    }

    const rows = slice.map((c, k) => ({
      user_id: userId,
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email,
      company: c.company,
      position: c.position,
      connected_on: c.connectedOn,
      linkedin_url: c.linkedinUrl,
      seniority: inferSeniority(c.position),
      company_norm: normalizeCompany(c.company),
      relationship_strength: "none",
      enrichment_status: "enriched",
      enriched_at: new Date().toISOString(),
      embedding: vectors[k] ? toVectorLiteral(vectors[k]!) : null,
    }));

    const { error } = await supa.from("connections").insert(rows);
    if (error) {
      console.error(`[INGEST] batch ${i}: connections insert FAILED — ${error.message} (code=${error.code})`);
      throw new Error(`connections insert @${i}: ${error.message}`);
    }
    done += rows.length;
    console.log(`[INGEST] batch ${i}: inserted ${rows.length} rows (${done}/${connections.length} total)`);
    await bumpJob(supa, jobId, done);
  }

  console.log(`[INGEST] processConnections done — ${connections.length} rows stored`);
  return connections.length;
}

/**
 * Match messages to the user's connections, roll up relationship aggregates, and
 * (in 'full' mode) embed + store message rows. 'metadata' = aggregates only.
 * 'none' = nothing (caller shouldn't pass a messages file).
 */
export async function processMessages(
  supa: SupabaseClient,
  userId: string,
  messagesCsv: string,
  mode: "full" | "metadata",
): Promise<{ matched: number }> {
  const { data: conns } = await supa.from("connections").select("id, linkedin_url").eq("user_id", userId);
  const urlToId = new Map<string, string>();
  for (const c of conns ?? []) {
    const n = normalizeLinkedInUrl(c.linkedin_url);
    if (n && !urlToId.has(n)) urlToId.set(n, c.id);
  }

  const { messages } = parseMessages(messagesCsv);
  const now = new Date();

  interface Agg { messageCount: number; sentCount: number; receivedCount: number; firstContacted: Date | null; lastContacted: Date | null; }
  const aggs = new Map<string, Agg>();
  const matched: { connId: string; m: ParsedMessage }[] = [];
  for (const m of messages) {
    const n = normalizeLinkedInUrl(m.partnerProfileUrl);
    const connId = n ? urlToId.get(n) : undefined;
    if (!connId) continue;
    matched.push({ connId, m });
    let a = aggs.get(connId);
    if (!a) { a = { messageCount: 0, sentCount: 0, receivedCount: 0, firstContacted: null, lastContacted: null }; aggs.set(connId, a); }
    a.messageCount++;
    if (m.direction === "sent") a.sentCount++; else a.receivedCount++;
    if (m.sentAt) {
      if (!a.firstContacted || m.sentAt < a.firstContacted) a.firstContacted = m.sentAt;
      if (!a.lastContacted || m.sentAt > a.lastContacted) a.lastContacted = m.sentAt;
    }
  }

  for (const [connId, a] of aggs) {
    await supa.from("connections").update({
      message_count: a.messageCount,
      sent_count: a.sentCount,
      received_count: a.receivedCount,
      first_contacted: a.firstContacted?.toISOString() ?? null,
      last_contacted: a.lastContacted?.toISOString() ?? null,
      relationship_strength: relationshipStrength(a, now),
    }).eq("id", connId);
  }

  if (mode === "full") {
    const texts = matched.map(({ m }) => [m.subject, m.content].filter(Boolean).join("\n"));
    const vectors = await embedTexts(texts);
    const rows = matched.map(({ connId, m }, k) => ({
      user_id: userId,
      connection_id: connId,
      conversation_id: m.conversationId,
      direction: m.direction,
      partner_name: m.partnerName,
      partner_profile_url: m.partnerProfileUrl,
      sent_at: m.sentAt?.toISOString() ?? null,
      subject: m.subject,
      content: m.content,
      embedding: vectors[k] ? toVectorLiteral(vectors[k]!) : null,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supa.from("messages").insert(rows.slice(i, i + 200));
      if (error) throw new Error(`messages insert @${i}: ${error.message}`);
    }
  }
  return { matched: matched.length };
}

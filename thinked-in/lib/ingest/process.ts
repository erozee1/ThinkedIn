import type { SupabaseClient } from "@supabase/supabase-js";
import { connectionSourceKey, parseConnections, fullName } from "../data/connections";
import { messageSourceKey, parseMessages } from "../data/messages";
import { inferSeniority } from "../data/seniority";
import { normalizeCompany } from "../data/normalize";
import { buildProfileText } from "../data/profile-text";
import { relationshipStrength } from "../data/relationships";
import { normalizeLinkedInUrl } from "../data/url";
import { embedTexts, toVectorLiteral } from "../embeddings";
import type { ParsedMessage, RawConnection } from "../data/types";

// Shared upload-processing logic used by the /api/upload route (and reusable by
// offline scripts). All writes go through the passed service-role client and are
// scoped to userId. Progress is tracked on the upload_jobs row so the UI can poll.

async function bumpJob(supa: SupabaseClient, jobId: string, enriched: number, status?: string) {
  const patch: Record<string, unknown> = { enriched_count: enriched, updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  await supa.from("upload_jobs").update(patch).eq("id", jobId);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function deleteRowsByIds(supa: SupabaseClient, table: "connections" | "messages", ids: string[]) {
  for (const slice of chunk(ids, 200)) {
    const { error } = await supa.from(table).delete().in("id", slice);
    if (error) throw new Error(`${table} delete: ${error.message}`);
  }
}

function dedupeConnections(connections: RawConnection[]): RawConnection[] {
  const unique = new Map<string, RawConnection>();
  for (const connection of connections) {
    const key = connectionSourceKey(connection);
    if (!key) continue;
    unique.set(key, connection);
  }
  return Array.from(unique.values());
}

export async function clearStoredMessages(supa: SupabaseClient, userId: string) {
  const { error } = await supa.from("messages").delete().eq("user_id", userId);
  if (error) throw new Error(`messages delete: ${error.message}`);
}

/**
 * Parse connections, insert baseline rows (CSV fields + seniority + normalized
 * company), embed each profile, and store. Sets enrichment_status='enriched'
 * (searchable) — Apify enrichment later only *adds* location/industry/photo.
 * Reconciles the latest export against existing rows for this user.
 */
export async function processConnections(
  supa: SupabaseClient,
  userId: string,
  connectionsCsv: string,
  jobId: string,
  orgId: string | null = null,
): Promise<number> {
  const connections = dedupeConnections(parseConnections(connectionsCsv));
  console.log(`[INGEST] processConnections start — ${connections.length} rows user=${userId} job=${jobId}`);

  const { data: existingConnections, error: existingErr } = await supa
    .from("connections")
    .select("id, linkedin_url, first_name, last_name")
    .eq("user_id", userId);
  if (existingErr) throw new Error(`connections lookup: ${existingErr.message}`);

  const existingByKey = new Map<string, string>();
  for (const row of existingConnections ?? []) {
    const key = connectionSourceKey({
      linkedinUrl: row.linkedin_url,
      firstName: row.first_name,
      lastName: row.last_name,
    });
    if (key && !existingByKey.has(key)) existingByKey.set(key, row.id);
  }

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

    const updates: Record<string, unknown>[] = [];
    const inserts: Record<string, unknown>[] = [];
    for (let k = 0; k < slice.length; k++) {
      const c = slice[k];
      const key = connectionSourceKey(c);
      if (!key) continue;
      const row = {
        user_id: userId,
        org_id: orgId,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        company: c.company,
        position: c.position,
        connected_on: c.connectedOn,
        linkedin_url: c.linkedinUrl,
        seniority: inferSeniority(c.position),
        company_norm: normalizeCompany(c.company),
        message_count: 0,
        sent_count: 0,
        received_count: 0,
        first_contacted: null,
        last_contacted: null,
        relationship_strength: "none",
        enrichment_status: "enriched",
        enriched_at: new Date().toISOString(),
        embedding: vectors[k] ? toVectorLiteral(vectors[k]!) : null,
      };

      const existingId = existingByKey.get(key);
      if (existingId) {
        updates.push({ id: existingId, ...row });
      } else {
        inserts.push(row);
      }
    }

    if (updates.length) {
      const { error } = await supa.from("connections").upsert(updates, { onConflict: "id" });
      if (error) {
        console.error(`[INGEST] batch ${i}: connections upsert FAILED — ${error.message} (code=${error.code})`);
        throw new Error(`connections upsert @${i}: ${error.message}`);
      }
    }

    if (inserts.length) {
      const { error } = await supa.from("connections").insert(inserts);
      if (error) {
        console.error(`[INGEST] batch ${i}: connections insert FAILED — ${error.message} (code=${error.code})`);
        throw new Error(`connections insert @${i}: ${error.message}`);
      }
    }

    done += slice.length;
    console.log(`[INGEST] batch ${i}: reconciled ${slice.length} rows (${done}/${connections.length} total)`);
    await bumpJob(supa, jobId, done);
  }

  const currentKeys = new Set(connections.map((c) => connectionSourceKey(c)).filter(Boolean));
  const staleIds = (existingConnections ?? [])
    .filter((row) => {
      const key = connectionSourceKey({
        linkedinUrl: row.linkedin_url,
        firstName: row.first_name,
        lastName: row.last_name,
      });
      return !key || !currentKeys.has(key) || existingByKey.get(key) !== row.id;
    })
    .map((row) => row.id);
  if (staleIds.length) {
    await deleteRowsByIds(supa, "connections", staleIds);
    console.log(`[INGEST] removed ${staleIds.length} stale connection rows`);
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
  if (mode === "metadata") {
    await clearStoredMessages(supa, userId);
  }

  const { data: conns } = await supa.from("connections").select("id, linkedin_url").eq("user_id", userId);
  const urlToId = new Map<string, string>();
  for (const c of conns ?? []) {
    const n = normalizeLinkedInUrl(c.linkedin_url);
    if (n && !urlToId.has(n)) urlToId.set(n, c.id);
  }

  const { messages } = parseMessages(messagesCsv);
  const uniqueMessages = new Map<string, ParsedMessage>();
  for (const message of messages) {
    uniqueMessages.set(messageSourceKey(message), message);
  }
  const now = new Date();

  interface Agg { messageCount: number; sentCount: number; receivedCount: number; firstContacted: Date | null; lastContacted: Date | null; }
  const aggs = new Map<string, Agg>();
  const matched: { connId: string; m: ParsedMessage }[] = [];
  for (const m of uniqueMessages.values()) {
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
    const { data: existingMessages, error: existingErr } = await supa
      .from("messages")
      .select("id, conversation_id, direction, partner_name, partner_profile_url, sent_at, subject, content")
      .eq("user_id", userId);
    if (existingErr) throw new Error(`messages lookup: ${existingErr.message}`);

    const existingByKey = new Map<string, string>();
    for (const row of existingMessages ?? []) {
      const key = messageSourceKey({
        conversationId: row.conversation_id,
        direction: row.direction as "sent" | "received",
        partnerName: row.partner_name,
        partnerProfileUrl: row.partner_profile_url,
        sentAt: row.sent_at,
        subject: row.subject,
        content: row.content,
      });
      if (!existingByKey.has(key)) existingByKey.set(key, row.id);
    }

    const texts = matched.map(({ m }) => [m.subject, m.content].filter(Boolean).join("\n"));
    const vectors = await embedTexts(texts);
    const incomingKeys = new Set<string>();
    const updates: Record<string, unknown>[] = [];
    const inserts: Record<string, unknown>[] = [];
    for (let k = 0; k < matched.length; k++) {
      const { connId, m } = matched[k];
      const key = messageSourceKey(m);
      incomingKeys.add(key);
      const row = {
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
      };

      const existingId = existingByKey.get(key);
      if (existingId) updates.push({ id: existingId, ...row });
      else inserts.push(row);
    }

    for (const slice of chunk(updates, 200)) {
      const { error } = await supa.from("messages").upsert(slice, { onConflict: "id" });
      if (error) throw new Error(`messages upsert: ${error.message}`);
    }
    for (const slice of chunk(inserts, 200)) {
      const { error } = await supa.from("messages").insert(slice);
      if (error) throw new Error(`messages insert: ${error.message}`);
    }

    const staleIds = (existingMessages ?? [])
      .filter((row) => {
        const key = messageSourceKey({
          conversationId: row.conversation_id,
          direction: row.direction as "sent" | "received",
          partnerName: row.partner_name,
          partnerProfileUrl: row.partner_profile_url,
          sentAt: row.sent_at,
          subject: row.subject,
          content: row.content,
        });
        return !incomingKeys.has(key) || existingByKey.get(key) !== row.id;
      })
      .map((row) => row.id);
    if (staleIds.length) await deleteRowsByIds(supa, "messages", staleIds);
  }
  return { matched: matched.length };
}

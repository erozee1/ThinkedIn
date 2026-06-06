/**
 * Offline message ingest (Path A). Run AFTER enrich.ts.
 *
 *   npx tsx --env-file=.env.local scripts/ingest-messages.ts --user <clerk_user_id> --mode full|metadata|none [csvPath]
 *
 * - none:     stores nothing; sets messages_mode='none'.
 * - metadata: rolls up per-connection relationship aggregates + strength only.
 * - full:     aggregates AND stores each message with an embedding of subject+content.
 */
import { readFileSync } from "node:fs";
import { parseMessages } from "../lib/data/messages";
import { relationshipStrength } from "../lib/data/relationships";
import { normalizeLinkedInUrl } from "../lib/data/url";
import { embedTexts, toVectorLiteral } from "../lib/embeddings";
import { createAdminClient } from "../lib/supabase/admin";
import type { ParsedMessage } from "../lib/data/types";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const userId = arg("--user");
const mode = (arg("--mode") ?? "metadata") as "full" | "metadata" | "none";
const csvPath = process.argv.slice(2).find((a) => a.endsWith(".csv")) ?? "../messages.csv";

if (!userId) {
  console.error("Missing --user <clerk_user_id>.");
  process.exit(1);
}
if (!["full", "metadata", "none"].includes(mode)) {
  console.error(`Invalid --mode '${mode}'. Use full | metadata | none.`);
  process.exit(1);
}

const NOW = new Date();

async function setMode(supa: ReturnType<typeof createAdminClient>) {
  const ts = NOW.toISOString();
  const { error } = await supa.from("user_settings").upsert(
    { user_id: userId, messages_mode: mode, messages_ingested_at: ts, consent_recorded_at: ts, updated_at: ts },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`user_settings upsert failed: ${error.message}`);
}

async function main() {
  const supa = createAdminClient();

  if (mode === "none") {
    // Wipe any prior message data and reset relationship columns.
    await supa.from("messages").delete().eq("user_id", userId);
    await supa
      .from("connections")
      .update({ message_count: 0, sent_count: 0, received_count: 0, first_contacted: null, last_contacted: null, relationship_strength: "none" })
      .eq("user_id", userId);
    await setMode(supa);
    console.log("\n✅ messages_mode=none — nothing stored.\n");
    return;
  }

  // Load this user's connections to match partners by normalized URL.
  const { data: conns, error: connErr } = await supa
    .from("connections")
    .select("id, linkedin_url")
    .eq("user_id", userId);
  if (connErr) throw new Error(`load connections failed: ${connErr.message}`);
  if (!conns?.length) throw new Error("No connections for this user — run enrich.ts first.");

  const urlToId = new Map<string, string>();
  for (const c of conns) {
    const n = normalizeLinkedInUrl(c.linkedin_url);
    if (n && !urlToId.has(n)) urlToId.set(n, c.id);
  }

  const { owner, messages } = parseMessages(readFileSync(csvPath, "utf8"));
  console.log(`Owner: ${owner.name} | ${messages.length} messages | ${conns.length} connections`);

  // Aggregate per connection id.
  interface Agg {
    messageCount: number; sentCount: number; receivedCount: number;
    firstContacted: Date | null; lastContacted: Date | null;
  }
  const aggs = new Map<string, Agg>();
  const matchedMessages: { connId: string; m: ParsedMessage }[] = [];

  for (const m of messages) {
    const n = normalizeLinkedInUrl(m.partnerProfileUrl);
    const connId = n ? urlToId.get(n) : undefined;
    if (!connId) continue;
    matchedMessages.push({ connId, m });
    let a = aggs.get(connId);
    if (!a) {
      a = { messageCount: 0, sentCount: 0, receivedCount: 0, firstContacted: null, lastContacted: null };
      aggs.set(connId, a);
    }
    a.messageCount++;
    if (m.direction === "sent") a.sentCount++;
    else a.receivedCount++;
    if (m.sentAt) {
      if (!a.firstContacted || m.sentAt < a.firstContacted) a.firstContacted = m.sentAt;
      if (!a.lastContacted || m.sentAt > a.lastContacted) a.lastContacted = m.sentAt;
    }
  }
  console.log(`Matched ${matchedMessages.length} messages to ${aggs.size} connections`);

  // Reset all relationship columns for this user, then apply aggregates (backfills 'none').
  await supa
    .from("connections")
    .update({ message_count: 0, sent_count: 0, received_count: 0, first_contacted: null, last_contacted: null, relationship_strength: "none" })
    .eq("user_id", userId);

  let updated = 0;
  for (const [connId, a] of aggs) {
    const { error } = await supa
      .from("connections")
      .update({
        message_count: a.messageCount,
        sent_count: a.sentCount,
        received_count: a.receivedCount,
        first_contacted: a.firstContacted?.toISOString() ?? null,
        last_contacted: a.lastContacted?.toISOString() ?? null,
        relationship_strength: relationshipStrength(a, NOW),
      })
      .eq("id", connId);
    if (error) throw new Error(`update connection ${connId} failed: ${error.message}`);
    updated++;
  }
  console.log(`Updated relationship aggregates on ${updated} connections`);

  // Always start clean on message rows.
  await supa.from("messages").delete().eq("user_id", userId);

  if (mode === "full") {
    console.log(`Embedding + storing ${matchedMessages.length} matched messages (full mode)...`);
    // Only matched messages are stored (they attach to a connection); embed subject+content.
    const texts = matchedMessages.map(({ m }) => [m.subject, m.content].filter(Boolean).join("\n"));
    const vectors = await embedTexts(texts);
    const rows = matchedMessages.map(({ connId, m }, i) => ({
      user_id: userId,
      connection_id: connId,
      conversation_id: m.conversationId,
      direction: m.direction,
      partner_name: m.partnerName,
      partner_profile_url: m.partnerProfileUrl,
      sent_at: m.sentAt?.toISOString() ?? null,
      subject: m.subject,
      content: m.content,
      embedding: vectors[i] ? toVectorLiteral(vectors[i]!) : null,
    }));
    let stored = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supa.from("messages").insert(batch);
      if (error) throw new Error(`message insert failed at ${i}: ${error.message}`);
      stored += batch.length;
      console.log(`  stored ${stored}/${rows.length}`);
    }
  }

  await setMode(supa);
  console.log(`\n✅ Ingested messages (mode=${mode}) for ${userId}\n`);
}

main().catch((e) => {
  console.error("\n❌ ingest-messages failed:", e.message, "\n");
  process.exit(1);
});

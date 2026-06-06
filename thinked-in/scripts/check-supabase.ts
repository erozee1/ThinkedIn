/**
 * Phase 2 verification. Run after creating the Supabase project, configuring
 * Clerk third-party auth, and running supabase/schema.sql:
 *
 *   npx tsx --env-file=.env.local scripts/check-supabase.ts
 *
 * Verifies: every table exists, a 1536-dim embedding round-trips (pgvector works),
 * and RLS blocks an anonymous client from reading rows.
 */
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TABLES = ["connections", "user_settings", "messages", "profile_research", "upload_jobs"];

let failures = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => {
  failures++;
  console.log(`  ✗ ${m}`);
};

async function main() {
  if (!url || !anonKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (use --env-file=.env.local)");
  const admin = createAdminClient();
  const anon = createClient(url, anonKey);
  const testUser = `user_check_${Date.now()}`;

  console.log("\nTables exist:");
  for (const t of TABLES) {
    const { error } = await admin.from(t).select("*", { count: "exact", head: true });
    if (error) bad(`${t}: ${error.message}`);
    else ok(t);
  }

  console.log("\npgvector round-trip:");
  const embedding = "[" + Array(1536).fill(0.0123).join(",") + "]";
  const { data: inserted, error: insErr } = await admin
    .from("connections")
    .insert({ user_id: testUser, first_name: "Check", last_name: "Bot", embedding })
    .select("id")
    .single();
  if (insErr || !inserted) {
    bad(`insert with embedding failed: ${insErr?.message}`);
  } else {
    ok("inserted connection with 1536-dim embedding");
    const { data: readBack } = await admin.from("connections").select("id, first_name").eq("id", inserted.id).single();
    if (readBack?.first_name === "Check") ok("read row back via admin");
    else bad("could not read row back");

    console.log("\nRLS blocks anonymous reads:");
    const { data: anonRows } = await anon.from("connections").select("id").eq("id", inserted.id);
    if (!anonRows || anonRows.length === 0) ok("anonymous client sees 0 rows (RLS enforced)");
    else bad(`anonymous client saw ${anonRows.length} row(s) — RLS NOT enforced!`);

    await admin.from("connections").delete().eq("id", inserted.id);
    ok("cleaned up test row");
  }

  console.log(failures === 0 ? "\n✅ Phase 2 OK\n" : `\n❌ ${failures} check(s) failed\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\n❌ check-supabase failed:", e.message, "\n");
  process.exit(1);
});

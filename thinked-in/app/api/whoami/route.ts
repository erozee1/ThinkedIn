import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Authenticated RLS diagnostic. Only accessible with a valid Clerk session.
// Returns whether the RLS client can see your own connections (vs the admin client).
// Safe to leave in — it cannot leak other users' data.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Admin client — bypasses RLS, always works if the DB is reachable.
  const admin = createAdminClient();
  const { count: adminCount, error: adminErr } = await admin
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // RLS client — depends on Clerk JWT being trusted by Supabase.
  const rls = createServerSupabaseClient();
  const { count: rlsCount, error: rlsErr } = await rls
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return Response.json({
    userId,
    admin: { count: adminCount ?? 0, error: adminErr?.message ?? null },
    rls:   { count: rlsCount   ?? 0, error: rlsErr?.message   ?? null },
    rlsWorking: !rlsErr && (rlsCount ?? 0) === (adminCount ?? 0),
  });
}

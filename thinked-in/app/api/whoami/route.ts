import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString());
  } catch {
    return null;
  }
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Inspect the token Supabase will receive.
  let token: string | null = null;
  let tokenClaims: Record<string, unknown> | null = null;
  let tokenError: string | null = null;
  try {
    token = await getToken({ template: "supabase" });
    tokenClaims = token ? decodeJwtPayload(token) : null;
  } catch (e) {
    tokenError = e instanceof Error ? e.message : String(e);
  }

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
    token: {
      obtained: Boolean(token),
      error: tokenError,
      claims: tokenClaims,
    },
    admin: { count: adminCount ?? 0, error: adminErr?.message ?? null },
    rls:   { count: rlsCount   ?? 0, error: rlsErr?.message   ?? null },
    rlsWorking: !rlsErr && (rlsCount ?? 0) === (adminCount ?? 0),
  });
}

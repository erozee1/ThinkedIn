import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Tells the dashboard whether the signed-in user already has a network loaded.
// (Temporarily returns diagnostics to debug a prod data-scoping mismatch.)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  let count: number | null = null;
  let totalAll: number | null = null;
  let queryError: string | null = null;
  let mode = "none";
  try {
    const supa = createAdminClient();
    const res = await supa
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    count = res.count ?? null;
    queryError = res.error?.message ?? null;

    const totalRes = await supa.from("connections").select("id", { count: "exact", head: true });
    totalAll = totalRes.count ?? null;

    const s = await supa.from("user_settings").select("messages_mode").eq("user_id", userId).maybeSingle();
    mode = s.data?.messages_mode ?? "none";
  } catch (e) {
    queryError = e instanceof Error ? e.message : String(e);
  }

  return Response.json({
    userId,
    hasConnections: (count ?? 0) > 0,
    connectionCount: count ?? 0,
    messagesMode: mode,
    _debug: {
      supabaseHost: url.replace(/^https?:\/\//, "").split(".")[0],
      serviceKeyLen: svc.length,
      totalConnectionsAllUsers: totalAll,
      queryError,
    },
  });
}

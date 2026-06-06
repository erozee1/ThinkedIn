import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Tells the dashboard whether the signed-in user already has a network loaded,
// so it can show chat instead of onboarding (source of truth = DB, not localStorage).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supa = createAdminClient();
  const [{ count }, { data: settings }] = await Promise.all([
    supa.from("connections").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supa.from("user_settings").select("messages_mode").eq("user_id", userId).maybeSingle(),
  ]);

  return Response.json({
    userId, // your live Clerk id — used to debug data scoping
    hasConnections: (count ?? 0) > 0,
    connectionCount: count ?? 0,
    messagesMode: settings?.messages_mode ?? "none",
  });
}

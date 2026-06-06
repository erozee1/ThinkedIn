import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tells the dashboard whether the signed-in user already has a network loaded.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supa = createServerSupabaseClient();
    const { data, error } = await supa
      .from("user_settings")
      .select("consent_recorded_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return Response.json({ hasConnections: false, error: error.message }, { status: 500 });
    }

    return Response.json({ hasConnections: Boolean(data?.consent_recorded_at) });
  } catch {
    return Response.json({ hasConnections: false }, { status: 500 });
  }
}

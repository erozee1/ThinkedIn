import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tells the dashboard whether the signed-in user already has a network loaded.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supa = createAdminClient();
    const { count, error } = await supa
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      return Response.json({ hasConnections: false, error: error.message }, { status: 500 });
    }

    return Response.json({ hasConnections: (count ?? 0) > 0 });
  } catch {
    return Response.json({ hasConnections: false }, { status: 500 });
  }
}

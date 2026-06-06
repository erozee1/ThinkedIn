import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Tells the dashboard whether the signed-in user already has a network loaded.
// (Temporarily returns diagnostics to debug a prod data-scoping mismatch.)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  let mineLen = 0;
  let anyLen = 0;
  let mineErr: unknown = null;
  let anyErr: unknown = null;
  try {
    const supa = createAdminClient();
    const mine = await supa.from("connections").select("id, user_id").eq("user_id", userId).limit(3);
    mineLen = mine.data?.length ?? 0;
    mineErr = mine.error ?? null;

    const any = await supa.from("connections").select("id, user_id").limit(3);
    anyLen = any.data?.length ?? 0;
    anyErr = any.error ?? null;
  } catch (e) {
    mineErr = e instanceof Error ? e.message : String(e);
  }

  return Response.json({
    userId,
    hasConnections: mineLen > 0,
    _debug: {
      supabaseHost: url.replace(/^https?:\/\//, "").split(".")[0],
      serviceKeyLen: svc.length,
      rowsForMe: mineLen,
      rowsAnyUser: anyLen,
      mineErr,
      anyErr,
    },
  });
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardApp from "@/components/dashboard/DashboardApp";
import { createAdminClient } from "@/lib/supabase/admin";

// Server decides the initial stage from the DB (source of truth), so a stale
// client cache can't strand a user in onboarding when they already have a network.
// Route is protected by Clerk's proxy.ts (only /sign-in and /sign-up are public).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/dashboard");

  let hasConnections = false;
  try {
    const supa = createAdminClient();
    const { count } = await supa
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    hasConnections = (count ?? 0) > 0;
  } catch {
    hasConnections = false;
  }

  return <DashboardApp initialStage={hasConnections ? "chat" : "onboarding"} />;
}

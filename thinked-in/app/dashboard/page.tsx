import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardApp from "@/components/dashboard/DashboardApp";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Server decides the initial stage from the DB (source of truth), so a stale
// client cache can't strand a user in onboarding when they already have a network.
// Route is protected by Clerk's proxy.ts (only /sign-in and /sign-up are public).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/dashboard");

  let hasOnboarded = false;
  try {
    const supa = createServerSupabaseClient();
    const { data } = await supa
      .from("user_settings")
      .select("consent_recorded_at")
      .eq("user_id", userId)
      .maybeSingle();
    hasOnboarded = Boolean(data?.consent_recorded_at);
  } catch {
    hasOnboarded = false;
  }

  return <DashboardApp initialStage={hasOnboarded ? "chat" : "onboarding"} />;
}

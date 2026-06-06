import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Supabase client scoped to the current Clerk user.
 *
 * The `accessToken` callback hands Supabase the Clerk session JWT on every
 * request, so RLS policies (`auth.jwt() ->> 'sub' = user_id`) enforce per-user
 * isolation at the database. Use this in route handlers and server components —
 * never the service-role client for user-facing reads/writes.
 */
export function createServerSupabaseClient() {
  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    accessToken: async () => {
      const { getToken } = await auth();
      return (await getToken()) ?? null;
    },
  });
}

/** The current Clerk user id, or null if signed out. */
export async function currentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

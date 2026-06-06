import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env";

/**
 * Service-role Supabase client. **Bypasses RLS** — server-side and offline
 * scripts only (enrichment, message ingest, Apify webhook receiver). NEVER
 * import this into client code, and ALWAYS filter by user_id explicitly, since
 * RLS is not protecting you here.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

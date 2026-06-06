import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "./supabase/admin";

// Long-lived bearer tokens for the Chrome extension. We store only a sha256
// hash of the token; the raw value is shown to the extension once at mint time.
const TOKEN_PREFIX = "tinext_";

const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

/** Mint a token for a Clerk user and persist its hash. Returns the raw token (shown once). */
export async function mintExtensionToken(userId: string, label = "chrome-extension"): Promise<string> {
  const raw = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const supa = createAdminClient();
  const { error } = await supa
    .from("extension_tokens")
    .insert({ user_id: userId, token_hash: hashToken(raw), label });
  if (error) throw new Error(`Could not mint extension token: ${error.message}`);
  return raw;
}

/** Verify a raw bearer token → the Clerk userId, or null. Best-effort touches last_used_at. */
export async function verifyExtensionToken(raw: string | null | undefined): Promise<string | null> {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;
  const supa = createAdminClient();
  const { data } = await supa
    .from("extension_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hashToken(raw))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await supa
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data.user_id as string;
}

/** Extract a Bearer token from an Authorization header. */
export function bearerFrom(request: Request): string | null {
  const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

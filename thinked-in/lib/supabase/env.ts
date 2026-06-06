// Small helpers so a missing env var fails loudly with a clear message
// rather than producing a confusing client error deep in a query.

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const SUPABASE_URL = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = () => requireEnv("SUPABASE_SERVICE_ROLE_KEY");

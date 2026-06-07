import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyExtensionToken, bearerFrom } from "@/lib/extension-auth";
import { normalizeLinkedInUrl } from "@/lib/data/url";
import { parseEventsBatch, type CaptureCounts } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The extension calls this cross-origin (from a chrome-extension:// background
// worker), so it does its OWN bearer-token auth and returns CORS headers.
// Whitelisted in proxy.ts so Clerk's cookie middleware doesn't block it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const userId = await verifyExtensionToken(bearerFrom(request));
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const batch = parseEventsBatch(body);
  if (!batch) return Response.json({ error: "Bad request" }, { status: 400, headers: CORS });

  const supa = createAdminClient();
  let freshened = 0;

  for (const ev of batch.events) {
    const norm = normalizeLinkedInUrl(ev.url);
    if (!norm) continue;

    let connectionId: string | null = null;
    let didFreshen = false;

    // Match the viewed profile to one of THIS user's connections by normalized URL.
    // Prefilter with ilike on the slug, then compare normalized URLs exactly.
    const slug = norm.split("/in/")[1] ?? null;
    if (slug) {
      const { data: rows } = await supa
        .from("connections")
        .select("id, linkedin_url, current_headline")
        .eq("user_id", userId)
        .ilike("linkedin_url", `%${slug}%`)
        .limit(5);
      const match = (rows ?? []).find((r) => normalizeLinkedInUrl(r.linkedin_url) === norm);
      if (match) {
        connectionId = match.id;
        didFreshen = true; // matched + refreshed (freshened_at), even if nothing changed
        // Only update the live HEADLINE — it's the reliably-correct top-card field.
        // We deliberately do NOT overwrite position/company: the top card often
        // shows the SCHOOL (not the employer), which would corrupt good data.
        const update: Record<string, unknown> = { freshened_at: new Date().toISOString() };
        if (ev.headline && ev.headline !== match.current_headline) update.current_headline = ev.headline;
        await supa.from("connections").update(update).eq("id", match.id);
        freshened++;
      }
    }

    await supa.from("linkedin_events").insert({
      user_id: userId,
      kind: ev.kind,
      linkedin_url: norm,
      payload: ev,
      connection_id: connectionId,
      freshened: didFreshen,
      observed_at: ev.observedAt,
    });
  }

  return Response.json({ ok: true, received: batch.events.length, freshened }, { headers: CORS });
}

export async function GET(request: NextRequest) {
  const userId = await verifyExtensionToken(bearerFrom(request));
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const supa = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const countFreshened = async (sinceIso?: string): Promise<number> => {
    let q = supa
      .from("linkedin_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "profile_view")
      .eq("freshened", true);
    if (sinceIso) q = q.gte("observed_at", sinceIso);
    const { count } = await q;
    return count ?? 0;
  };

  const counts: CaptureCounts = {
    today: { profiles: await countFreshened(startOfDay.toISOString()), messages: 0 },
    allTime: { profiles: await countFreshened(), messages: 0 },
  };
  return Response.json(counts, { headers: CORS });
}

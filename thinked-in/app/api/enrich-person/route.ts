import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCard } from "@/lib/agent/cards";
import type { ConnectionRow } from "@/lib/agent/retrieval";
import type { ProfileCardData } from "@/lib/types";

const CONN_COLS =
  "id, user_id, first_name, last_name, position, company, location, country, seniority, industry, summary, linkedin_url, relationship_strength, last_contacted, message_count";

const STRENGTH_RANK: Record<string, number> = {
  close: 4, active: 3, warm: 2, dormant: 1, none: 0,
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { company, excludeId } = (await req.json()) as {
    company?: string;
    excludeId?: string;
  };

  if (!company?.trim()) return Response.json({ coworkers: [] });

  const supa = createAdminClient();

  const { data } = await supa
    .from("connections")
    .select(CONN_COLS)
    .eq("user_id", userId)
    .ilike("company", `%${company.trim()}%`)
    .limit(12);

  const coworkers: ProfileCardData[] = ((data ?? []) as ConnectionRow[])
    .filter((r) => r.id !== excludeId)
    .sort(
      (a, b) =>
        (STRENGTH_RANK[b.relationship_strength ?? "none"] ?? 0) -
        (STRENGTH_RANK[a.relationship_strength ?? "none"] ?? 0),
    )
    .slice(0, 6)
    .map((r) => ({
      ...toCard(r),
      relationshipStrength: r.relationship_strength ?? undefined,
      lastContacted: r.last_contacted ?? null,
    }));

  return Response.json({ coworkers });
}

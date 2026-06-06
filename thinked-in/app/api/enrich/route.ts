import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnrichmentProgress } from "@/lib/types";

// Real progress: reads the upload_jobs row (scoped to the Clerk user) that the
// /api/upload background task updates as connections are embedded.
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get("job_id") ?? "";
  if (!jobId) return Response.json({ error: "Missing job_id" }, { status: 400 });

  const supa = createAdminClient();
  const { data: job, error } = await supa
    .from("upload_jobs")
    .select("id, user_id, total_connections, enriched_count, status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !job) return Response.json({ error: "Job not found" }, { status: 404 });

  const total = job.total_connections ?? 0;
  const enrichedCount = job.enriched_count ?? 0;
  const ratio = total > 0 ? Math.min(1, enrichedCount / total) : 0;

  const progress: EnrichmentProgress = {
    jobId: job.id,
    total,
    enrichedCount,
    ratio,
    status: (job.status as EnrichmentProgress["status"]) ?? "processing",
  };
  return Response.json(progress);
}

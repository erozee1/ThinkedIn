import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { EnrichmentProgress } from "@/lib/types";

// STUB: reports enrichment progress for a job. Progress is derived from the
// timestamp encoded in the jobId so the endpoint is stateless. The real
// version will poll Apify + return DB-backed counts.
const ENRICH_DURATION_MS = 7000;

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("job_id") ?? "";
  const match = /^job_(\d+)_(\d+)$/.exec(jobId);
  if (!match) {
    return Response.json({ error: "Invalid job_id" }, { status: 400 });
  }

  const startedAt = Number(match[1]);
  const total = Number(match[2]);
  const elapsed = Date.now() - startedAt;
  const ratio = Math.min(1, elapsed / ENRICH_DURATION_MS);
  const enrichedCount = Math.min(total, Math.round(total * ratio));

  const progress: EnrichmentProgress = {
    jobId,
    total,
    enrichedCount,
    status: ratio >= 1 ? "complete" : "processing",
  };

  return Response.json(progress);
}

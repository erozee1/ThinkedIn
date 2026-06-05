import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

// STUB: accepts the uploaded CSV and returns a job id + connection count.
// The real version will parse rows, insert pending connections per user, and
// kick off Apify enrichment. We never persist the file here.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let total = 0;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) {
      const text = await file.text();
      // Count non-empty data rows (minus header). Best-effort for the stub.
      const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      total = Math.max(0, rows.length - 1);
    }
  } catch {
    // ignore — fall back to a plausible demo number below
  }

  if (!total) total = 312; // demo fallback when no/empty file

  // Simulate server-side intake latency.
  await new Promise((r) => setTimeout(r, 600));

  // Encode start time + total into the job id so /api/enrich can report
  // progress without server-side state.
  const jobId = `job_${Date.now()}_${total}`;

  return Response.json({ jobId, totalConnections: total });
}

import type { NextRequest } from "next/server";
import { strFromU8, unzipSync } from "fflate";
import { isAuthorized } from "@/lib/server-auth";

// Accepts the user's LinkedIn export .zip, unzips it in-memory on the server,
// and extracts the two relevant files (Connections.csv + messages.csv). We
// count the connections and return a job id. The file is parsed in memory and
// discarded — never persisted. (A direct .csv upload is also accepted.)
//
// Note: this is the upload step of the stubbed pipeline — enrichment/storage
// (Apify/Supabase) still come later behind /api/enrich.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let total = 0;
  let foundConnections = false;
  let foundMessages = false;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (file instanceof File) {
      const name = file.name.toLowerCase();

      if (name.endsWith(".zip")) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const entries = unzipSync(buf);
        for (const path of Object.keys(entries)) {
          const base = path.split("/").pop()?.toLowerCase() ?? "";
          if (base === "connections.csv") {
            foundConnections = true;
            total = countConnections(strFromU8(entries[path]));
          } else if (base === "messages.csv") {
            foundMessages = true;
          }
        }
      } else if (name.endsWith(".csv")) {
        foundConnections = true;
        total = countConnections(await file.text());
      }
    }
  } catch {
    // Malformed/empty upload — fall back to a plausible demo number below.
  }

  if (!total) total = 312; // demo fallback

  // Simulate server-side intake latency.
  await new Promise((r) => setTimeout(r, 600));

  // Encode start time + total into the job id so /api/enrich can report
  // progress without server-side state.
  const jobId = `job_${Date.now()}_${total}`;

  return Response.json({ jobId, totalConnections: total, foundConnections, foundMessages });
}

// LinkedIn's Connections.csv has a few "Notes:" preamble lines before the header
// row (which contains "First Name"/"Last Name"). Count data rows after it.
function countConnections(csv: string): number {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(
    (l) => /first name/i.test(l) && /last name/i.test(l),
  );
  if (headerIdx >= 0) return Math.max(0, lines.length - headerIdx - 1);
  return Math.max(0, lines.length - 1);
}

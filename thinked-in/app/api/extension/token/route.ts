import { auth } from "@clerk/nextjs/server";
import { mintExtensionToken } from "@/lib/extension-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called from the /extension/connect page (browser, Clerk session present).
// Mints a long-lived token the extension stores and sends as Bearer to /api/events.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = await mintExtensionToken(userId);
  return Response.json({ token });
}

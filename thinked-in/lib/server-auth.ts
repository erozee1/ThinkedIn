import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

// Authorized if there's a Clerk session OR the dev bypass cookie is set.
// TEMPORARY bypass — remove once real login works.
export async function isAuthorized(request: NextRequest): Promise<boolean> {
  const { userId } = await auth();
  if (userId) return true;
  return request.cookies.get("tk_bypass")?.value === "1";
}

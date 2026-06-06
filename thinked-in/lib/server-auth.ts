import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

export async function isAuthorized(request: NextRequest): Promise<boolean> {
  const { userId } = await auth();
  return Boolean(userId);
}

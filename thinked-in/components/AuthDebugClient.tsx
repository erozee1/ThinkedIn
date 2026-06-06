"use client";

import { useAuth, useUser } from "@clerk/nextjs";

export default function AuthDebugClient() {
  const auth = useAuth();
  const { user, isLoaded } = useUser();

  return (
    <div className="rounded-2xl bg-black/[0.04] p-4 text-sm text-foreground">
      <div className="font-medium text-foreground">Client auth</div>
      <div className="mt-2">isLoaded: {String(isLoaded)}</div>
      <div>isSignedIn: {String(auth.isSignedIn)}</div>
      <div>userId: {auth.userId ?? "null"}</div>
      <div>sessionId: {auth.sessionId ?? "null"}</div>
      <div>orgId: {auth.orgId ?? "null"}</div>
      <div>user email: {user?.primaryEmailAddress?.emailAddress ?? "null"}</div>
    </div>
  );
}

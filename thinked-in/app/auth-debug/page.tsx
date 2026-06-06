import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import AuthDebugClient from "@/components/AuthDebugClient";

export const dynamic = "force-dynamic";

export default async function AuthDebugPage() {
  const { userId, sessionId, orgId, getToken } = await auth();
  const hdrs = await headers();
  const cookieStore = await cookies();
  const token = await getToken().catch(() => null);
  const host = hdrs.get("host");
  const origin = hdrs.get("origin");
  const referer = hdrs.get("referer");
  const allCookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const clerkCookieNames = allCookieNames.filter((name) =>
    name.includes("clerk") || name === "__session" || name === "__client_uat",
  );
  const hasSessionCookie = allCookieNames.includes("__session");
  const hasClientUatCookie = allCookieNames.includes("__client_uat");

  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Clerk auth debug
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Production auth state
          </h1>
          <p className="mt-2 text-sm text-muted">
            This page is public so it can show what Clerk sees without the dashboard
            redirect getting in the way.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-black/[0.04] p-4 text-sm text-foreground">
            <div className="font-medium text-foreground">Server auth</div>
            <div className="mt-2">userId: {userId ?? "null"}</div>
            <div>sessionId: {sessionId ?? "null"}</div>
            <div>orgId: {orgId ?? "null"}</div>
            <div>token present: {String(Boolean(token))}</div>
            <div>__session cookie present: {String(hasSessionCookie)}</div>
            <div>__client_uat cookie present: {String(hasClientUatCookie)}</div>
          </div>

          <div className="rounded-2xl bg-black/[0.04] p-4 text-sm text-foreground">
            <div className="font-medium text-foreground">Request</div>
            <div className="mt-2">host: {host ?? "null"}</div>
            <div>origin: {origin ?? "null"}</div>
            <div>referer: {referer ?? "null"}</div>
            <div>publishable key present: {String(Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY))}</div>
            <div>secret key present: {String(Boolean(process.env.CLERK_SECRET_KEY))}</div>
            <div>clerk-related cookies: {clerkCookieNames.length ? clerkCookieNames.join(", ") : "none"}</div>
          </div>
        </div>

        <AuthDebugClient />

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-gradient-blue px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95"
          >
            Try dashboard
          </Link>
          <Link
            href="/sign-in?redirect_url=/dashboard"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-muted transition-all hover:text-foreground active:scale-95"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// "/" is the public marketing landing (signed-out hero → "Get started").
// Everything else (e.g. /dashboard, /api/*) stays protected.
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Dev bypass: a `tk_bypass=1` cookie skips auth (set by the bypass-login
  // button). TEMPORARY — remove once real login works.
  const bypass = request.cookies.get("tk_bypass")?.value === "1";
  if (!isPublicRoute(request) && !bypass) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};

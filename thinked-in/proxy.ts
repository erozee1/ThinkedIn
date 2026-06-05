import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// "/" is the public marketing landing (signed-out hero → "Get started").
// Everything else (e.g. /dashboard, /api/*) stays protected.
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/proof", "/research", "/pricing", "/waitlist(.*)", "/api/debug"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
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

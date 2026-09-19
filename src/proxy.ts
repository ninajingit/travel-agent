import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything under /app needs a signed-in user. Signed-out requests are sent
// to /sign-in and come back to the page they asked for.
const isAppRoute = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isAppRoute(request)) {
      await auth.protect();
    }
  },
  // Same URLs as ClerkProvider in the root layout; the proxy cannot see those.
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    // Run on every route except Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes so route handlers can read auth().
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname;

  // Check if the user is authenticated by looking for a token in cookies
  const token = request.cookies.get("session")?.value;

  // Create a response object that we'll modify and return
  let response = NextResponse.next();

  // Redirect old signup page to new join page
  if (pathname === "/signup") {
    return NextResponse.redirect(new URL("/join", request.url), { status: 301 });
  }

  // Protected routes - require authentication
  const protectedRoutes = ["/dashboard", "/member"];
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 302,
      headers: {
        "Set-Cookie": "auth-redirect=true; Path=/; HttpOnly; Max-Age=60",
      },
    });
  }

  // Check if this is a form submission
  const isFormSubmission =
    request.method === "POST" &&
    request.headers.get("content-type")?.includes("application/x-www-form-urlencoded");

  // Add caching headers based on the path
  // Skip adding cache headers for authenticated routes, API routes that handle their own caching, and form submissions
  if (
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/api/trails") &&
    !isFormSubmission
  ) {
    // Default caching strategy for most pages
    let cacheControl = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

    // Different caching strategies based on content type
    if (pathname.startsWith("/_next/static/")) {
      // Static assets can be cached for a very long time
      cacheControl = "public, max-age=31536000, immutable";
    } else if (pathname.startsWith("/_next/image")) {
      // Images can be cached for a day, with a week of stale-while-revalidate
      cacheControl = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=31536000";
    } else if (pathname.startsWith("/api/")) {
      // API routes should have shorter cache times
      cacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
    }

    // Add the Cache-Control header to the response
    response.headers.set("Cache-Control", cacheControl);
  }

  return response;
}

// Configure the middleware to run on all paths except specific ones
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/trails (has its own caching)
     * 2. /api/submit-form (should not be cached)
     * 3. /api/webhooks (webhook handlers - must not be modified)
     * 4. /_next/static (handled by Netlify headers)
     * 5. /_next/image (handled by Netlify headers)
     * 6. /favicon.ico, /sitemap.xml, /robots.txt (static files)
     */
    "/((?!api/trails|api/submit-form|api/webhooks|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

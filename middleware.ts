import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authAdmin, db } from '@/lib/firebaseAdmin'; // Assuming @ points to src

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ALLOWED_EMAIL;

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('firebase-id-token')?.value;

  // Helper to redirect to login
  const redirectToLogin = (url: URL) => {
    const redirectUrl = new URL('/login', url);
    // Optional: Add a query param to indicate why the user was redirected
    // redirectUrl.searchParams.set('reason', 'unauthorized');
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      // Optional: Set a cookie to indicate auth redirect, useful for UX on login page
      // headers: { 'Set-Cookie': 'auth-redirect=true; Path=/; HttpOnly; Max-Age=60' }
    });
  };

  // Members Area Protection
  if (pathname.startsWith('/members')) {
    if (!token) {
      console.log('Middleware: No token for /members, redirecting to login.');
      return redirectToLogin(request.url);
    }
    try {
      const decodedToken = await authAdmin.verifyIdToken(token);
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();

      if (userDoc.exists && userDoc.data()?.membership?.status === 'active') {
        // User has active membership, allow access
        // Proceed to caching logic
      } else {
        console.log(`Middleware: User ${decodedToken.uid} does not have active membership for /members. Redirecting to profile.`);
        // Redirect to profile page if membership is not active or profile doesn't exist
        return NextResponse.redirect(new URL('/dashboard/profile', request.url));
      }
    } catch (error) {
      console.error('Middleware: Error verifying token or fetching user for /members:', error);
      return redirectToLogin(request.url); // Token verification or Firestore fetch failed
    }
  }
  // Dashboard Area Protection (Admin access)
  else if (pathname.startsWith('/dashboard')) {
    if (!token) {
      console.log('Middleware: No token for /dashboard, redirecting to login.');
      return redirectToLogin(request.url);
    }
    try {
      const decodedToken = await authAdmin.verifyIdToken(token);
      if (decodedToken.email === ADMIN_EMAIL) {
        // User is admin, allow access to /dashboard/**
        // Proceed to caching logic by letting response be NextResponse.next()
      } else {
        // Non-admin user with a valid token trying to access /dashboard.
        // This could be a regular user who landed on /dashboard manually.
        // If /dashboard/profile is the main landing for them, redirect there.
        // Or, if /dashboard is meant to be an admin-only zone, redirect non-admins to login or an access-denied page.
        // For now, as per requirement, if email doesn't match ADMIN_EMAIL, redirect to login.
        console.log(`Middleware: Token email ${decodedToken.email} does not match ADMIN_EMAIL for /dashboard.`);
        return redirectToLogin(request.url);
      }
    } catch (error) {
      console.error('Middleware: Error verifying token for /dashboard (admin check):', error);
      return redirectToLogin(request.url); // Token verification failed
    }
  }

  // If we've reached here, the request is either public, or auth checks passed.
  // Now, apply caching logic.
  let response = NextResponse.next();

  const isFormSubmission = 
    request.method === 'POST' && 
    request.headers.get('content-type')?.includes('application/x-www-form-urlencoded');
  
  // Determine if the route is authenticated (and auth check passed for that route type)
  const isMembersRouteAllowed = pathname.startsWith('/members') && token; // Simplified: actual allowance decided above
  const isDashboardRouteAllowedForAdmin = pathname.startsWith('/dashboard') && token; // Simplified

  const isAuthenticatedRoute = isMembersRouteAllowed || isDashboardRouteAllowedForAdmin;

  // Skip adding cache headers for authenticated routes that passed,
  // API routes that handle their own caching, and form submissions.
  // Public routes or routes where auth checks didn't lead to a redirect will get caching headers.
  if (!isAuthenticatedRoute && !pathname.startsWith('/api/trails') && !isFormSubmission && !pathname.startsWith('/api/auth/')) {
    // Default caching strategy for most pages
    let cacheControl = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
    
    if (pathname.startsWith('/_next/static/')) {
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (pathname.startsWith('/_next/image')) {
      cacheControl = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=31536000';
    } else if (pathname.startsWith('/api/')) { // General API routes, excluding /api/auth
      cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
    }
    
    response.headers.set('Cache-Control', cacheControl);
  } else if (isAuthenticatedRoute && token) {
    // For authenticated routes that are allowed, prevent client-side caching
    // and encourage revalidation from the server/CDN.
    response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
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
     * 3. /_next/static (handled by Netlify headers)
     * 4. /_next/image (handled by Netlify headers)
     * 5. /favicon.ico, /sitemap.xml, /robots.txt (static files)
     */
    '/((?!api/trails|api/submit-form|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

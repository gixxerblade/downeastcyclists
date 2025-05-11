import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname;
  
  // Check if the user is authenticated by looking for a token in cookies
  const token = request.cookies.get('auth-token')?.value;
  
  // Create a response object that we'll modify and return
  let response = NextResponse.next();
  
  // If the request is for the dashboard and there's no token, redirect to login
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url), { 
      status: 302,
      headers: {
        'Set-Cookie': 'auth-redirect=true; Path=/; HttpOnly; Max-Age=60'
      }
    });
  }
  
  // Add caching headers based on the path
  // Skip adding cache headers for authenticated routes and API routes that handle their own caching
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api/trails')) {
    // Default caching strategy for most pages
    let cacheControl = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
    
    // Different caching strategies based on content type
    if (pathname.startsWith('/_next/static/')) {
      // Static assets can be cached for a very long time
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (pathname.startsWith('/_next/image')) {
      // Images can be cached for a day, with a week of stale-while-revalidate
      cacheControl = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=31536000';
    } else if (pathname.startsWith('/api/')) {
      // API routes should have shorter cache times
      cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
    }
    
    // Add the Cache-Control header to the response
    response.headers.set('Cache-Control', cacheControl);
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

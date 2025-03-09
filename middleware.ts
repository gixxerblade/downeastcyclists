import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Check if the user is authenticated by looking for a token in cookies
  const token = request.cookies.get('auth-token')?.value;
  
  // If the request is for the dashboard and there's no token, redirect to login
  // Use replace: true to replace the current history entry
  if (request.nextUrl.pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url), { 
      status: 302,
      headers: {
        'Set-Cookie': 'auth-redirect=true; Path=/; HttpOnly; Max-Age=60'
      }
    });
  }
  
  return NextResponse.next();
}

// Configure the middleware to run only on specific paths
export const config = {
  matcher: ['/dashboard/:path*'],
};

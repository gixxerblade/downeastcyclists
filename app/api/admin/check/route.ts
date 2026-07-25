import {Effect} from 'effect';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {getDashboardCapabilities} from '@/src/lib/access-control';
import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({isAdmin: false, authenticated: false}, {status: 200});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const access = yield* admin.getAccess(sessionCookie);
        return {
          authenticated: true,
          isAdmin: access.role === 'admin',
          isStaff: access.role === 'admin' || access.role === 'organizer',
          uid: access.uid,
          email: access.email,
          role: access.role,
          capabilities: getDashboardCapabilities(access.role),
        };
      }),
    errorTags: ['SessionError', 'AuthError', 'DatabaseError'],
  });
}

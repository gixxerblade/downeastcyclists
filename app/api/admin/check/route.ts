import {Effect} from 'effect';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

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
        const adminUser = yield* admin.verifyAdmin(sessionCookie);
        return {isAdmin: true, authenticated: true, uid: adminUser.uid, email: adminUser.email};
      }).pipe(Effect.catchAll(() => Effect.succeed({isAdmin: false, authenticated: true}))),
    errorTags: [],
  });
}

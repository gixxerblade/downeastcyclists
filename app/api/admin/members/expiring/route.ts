import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

// GET - Get expiring memberships report
export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam) : 30;

  // Validate days parameter
  if (![30, 60, 90].includes(days)) {
    return Response.json({error: 'Days must be 30, 60, or 90'}, {status: 400});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.getExpiringMemberships(days as 30 | 60 | 90);
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'FirestoreError'],
  });
}

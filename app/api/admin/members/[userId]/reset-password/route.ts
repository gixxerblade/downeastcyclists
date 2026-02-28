import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

export async function POST(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.verifyAdmin(sessionCookie);
        yield* admin.sendPasswordReset(userId);
        return {sent: true};
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'MemberNotFoundError',
      'EmailError',
    ],
  });
}

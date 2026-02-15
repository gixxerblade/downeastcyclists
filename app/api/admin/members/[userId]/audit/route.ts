import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

// GET - Get member audit log
export async function GET(_request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.getMemberAuditLog(userId);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'MemberNotFoundError',
    ],
  });
}

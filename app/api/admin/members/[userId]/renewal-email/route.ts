import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

export async function POST(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;
  const body = (await request.json().catch(() => ({}))) as {resend?: boolean};

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const adminUser = yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.sendRenewalEmail(userId, adminUser.uid, adminUser.email, {
          resend: body.resend === true,
        });
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

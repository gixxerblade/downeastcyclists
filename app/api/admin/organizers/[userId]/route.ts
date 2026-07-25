import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

export async function PATCH(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;
  const body: unknown = await request.json();
  const isOrganizer =
    typeof body === 'object' &&
    body !== null &&
    'isOrganizer' in body &&
    typeof body.isOrganizer === 'boolean'
      ? body.isOrganizer
      : null;

  if (isOrganizer === null) {
    return Response.json({error: 'isOrganizer must be a boolean'}, {status: 400});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.setOrganizerRole(sessionCookie, userId, isOrganizer);
        return {success: true, isOrganizer};
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'NotFoundError',
      'AdminError',
    ],
  });
}

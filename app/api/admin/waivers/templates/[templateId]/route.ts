import {Schema as S} from 'effect';
import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {ValidationError} from '@/src/lib/effect/errors';
import {WaiverTemplateUpdate} from '@/src/lib/waivers/schemas';
import {updateWaiverTemplateStatus} from '@/src/lib/waivers/service';

export async function PATCH(
  request: NextRequest,
  context: {params: Promise<{templateId: string}>},
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const {templateId} = await context.params;

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'waivers:manage');
        const input = yield* S.decodeUnknown(WaiverTemplateUpdate)(body).pipe(
          Effect.mapError(
            (cause) =>
              new ValidationError({field: 'action', message: 'Invalid waiver action', cause}),
          ),
        );
        return yield* updateWaiverTemplateStatus(templateId, input.action);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'ValidationError',
      'NotFoundError',
    ],
  });
}

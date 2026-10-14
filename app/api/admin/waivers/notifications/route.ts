import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {ValidationError} from '@/src/lib/effect/errors';
import {sendUnsignedWaiverEmails} from '@/src/lib/waivers/service';

export async function POST(request: NextRequest) {
  let templateId: string | undefined;
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && 'templateId' in body) {
      templateId = typeof body.templateId === 'string' ? body.templateId : undefined;
    }
  } catch {
    templateId = undefined;
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const access = yield* admin.authorize(sessionCookie, 'waivers:manage');
        if (!templateId) {
          return yield* Effect.fail(
            new ValidationError({field: 'templateId', message: 'Select a waiver'}),
          );
        }
        return yield* sendUnsignedWaiverEmails(templateId, access.uid, access.email);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'EmailError',
      'WaiverConfigurationError',
      'ValidationError',
      'NotFoundError',
    ],
  });
}

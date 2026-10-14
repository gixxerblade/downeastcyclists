import {Schema as S} from 'effect';
import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {ValidationError} from '@/src/lib/effect/errors';
import {WaiverTemplateInput} from '@/src/lib/waivers/schemas';
import {createWaiverTemplate, listWaiverTemplates} from '@/src/lib/waivers/service';

export async function GET() {
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'waivers:read');
        return yield* listWaiverTemplates();
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const access = yield* admin.authorize(sessionCookie, 'waivers:manage');
        const input = yield* S.decodeUnknown(WaiverTemplateInput)(body).pipe(
          Effect.mapError(
            (cause) =>
              new ValidationError({
                field: 'body',
                message: 'Please complete the waiver template',
                cause,
              }),
          ),
        );
        return yield* createWaiverTemplate(input, access.uid);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'ValidationError',
    ],
  });
}

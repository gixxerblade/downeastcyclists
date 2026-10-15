import {Effect, Schema as S} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {UnauthorizedError, ValidationError} from '@/src/lib/effect/errors';
import {WaiverEmailRequest} from '@/src/lib/waivers/email-schemas';
import {
  sendUnsignedWaiverEmails,
  sendTestWaiverEmail,
  previewWaiverEmail,
} from '@/src/lib/waivers/service';

export async function GET(request: NextRequest) {
  const response = await handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const access = yield* admin.authorize(sessionCookie, 'waivers:manage');
        if (!access.email)
          return yield* new UnauthorizedError({
            message: 'The administrative account needs a verified email address.',
          });
        const templateId = yield* S.decodeUnknown(S.UUID)(
          request.nextUrl.searchParams.get('templateId'),
        ).pipe(
          Effect.mapError(
            () => new ValidationError({field: 'templateId', message: 'Select a waiver'}),
          ),
        );
        return yield* previewWaiverEmail(
          templateId,
          access.email,
          request.nextUrl.searchParams.get('reminder') === 'true',
        );
      }),
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const access = yield* admin.authorize(sessionCookie, 'waivers:manage');
        if (!access.email)
          return yield* new UnauthorizedError({
            message: 'The administrative account needs a verified email address.',
          });
        const input = yield* S.decodeUnknown(WaiverEmailRequest)(body, {
          onExcessProperty: 'error',
        }).pipe(
          Effect.mapError(
            () =>
              new ValidationError({
                field: 'request',
                message:
                  'Select members for an invitation, confirm a reminder, or send a test to yourself.',
              }),
          ),
        );
        return input.action === 'test'
          ? yield* sendTestWaiverEmail(
              input.templateId,
              {uid: access.uid, email: access.email},
              input.requestId,
              input.reminder,
            )
          : yield* sendUnsignedWaiverEmails(input.templateId, access.uid, access.email, input);
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

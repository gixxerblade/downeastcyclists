import {Schema as S} from 'effect';
import {Effect} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {getTrustedClientIp} from '@/src/lib/api/client-identity';
import {ValidationError} from '@/src/lib/effect/errors';
import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';
import {WaiverSignatureInput} from '@/src/lib/waivers/schemas';
import {signWaiver} from '@/src/lib/waivers/service';

function getClientIp(request: NextRequest): string | null {
  return getTrustedClientIp(request) ?? request.headers.get('x-real-ip');
}

export async function POST(request: NextRequest, context: {params: Promise<{templateId: string}>}) {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: 'Invalid request body'}, {status: 400});
  }
  const {templateId} = await context.params;

  const program = Effect.gen(function* () {
    const input = yield* S.decodeUnknown(WaiverSignatureInput)(body).pipe(
      Effect.mapError(
        (cause) =>
          new ValidationError({
            field: 'body',
            message: 'Please complete every required waiver field',
            cause,
          }),
      ),
    );
    const portal = yield* PortalService;
    const session = yield* portal.verifySession(sessionCookie);
    return yield* signWaiver(session.uid, session.email ?? '', templateId, input, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });
  }).pipe(
    Effect.catchTag('WaiverConfigurationError', () =>
      Effect.succeed({
        error: 'Waiver signing is temporarily unavailable. Please contact the club administrator.',
        status: 503,
      }),
    ),
    Effect.catchTag('SessionError', () =>
      Effect.succeed({error: 'Your session expired. Please sign in again.', status: 401}),
    ),
    Effect.catchTag('AuthError', () =>
      Effect.succeed({error: 'Unable to verify your account', status: 401}),
    ),
    Effect.catchTag('ValidationError', (error) =>
      Effect.succeed({error: error.message, field: error.field, status: 400}),
    ),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({error: 'Member not found', status: 404}),
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({error: 'Unable to save your waiver', status: 500}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
  if ('error' in result) {
    return NextResponse.json(
      {error: result.error, field: 'field' in result ? result.field : undefined},
      {status: result.status},
    );
  }
  return NextResponse.json(result, {status: result.alreadySigned ? 200 : 201});
}

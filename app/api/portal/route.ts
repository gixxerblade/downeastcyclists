import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';

export async function POST(request: NextRequest) {
  const {returnUrl} = await request.json();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  if (!returnUrl) {
    return NextResponse.json({error: 'Return URL is required'}, {status: 400});
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;

      // Verify session and get user ID
      const session = yield* portal.verifySession(sessionCookie);

      // Create portal session
      return yield* portal.createPortalSession(session.uid, returnUrl);
    }),

    Effect.catchTag('SessionError', () =>
      Effect.succeed({
        error: 'Session expired',
        _tag: 'error' as const,
        status: 401,
      }),
    ),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: `No ${error.resource} found`,
        _tag: 'error' as const,
        status: 404,
      }),
    ),
    Effect.catchTag('StripeError', (error) =>
      Effect.succeed({
        error: error.message,
        _tag: 'error' as const,
        status: 500,
      }),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {LiveLayer} from '@/src/lib/effect/layers';
import {MembershipService} from '@/src/lib/effect/membership.service';
import {PortalService} from '@/src/lib/effect/portal.service';

interface RouteParams {
  params: Promise<{userId: string}>;
}

export async function GET(request: NextRequest, {params}: RouteParams) {
  const {userId} = await params;

  if (!userId) {
    return NextResponse.json({error: 'User ID is required'}, {status: 400});
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const membershipService = yield* MembershipService;
      const session = yield* portal.verifySession(sessionCookie);
      if (session.uid !== userId) {
        return yield* Effect.fail({
          _tag: 'UnauthorizedError' as const,
          message: 'You can only view your own membership',
        });
      }
      return yield* membershipService.getMembershipStatus(userId);
    }),

    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: `${error.resource} not found`,
        _tag: 'error' as const,
        status: 404,
      }),
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.succeed({
        error: error.message,
        _tag: 'error' as const,
        status: 500,
      }),
    ),
    Effect.catchTag('SessionError', () =>
      Effect.succeed({error: 'Session invalid', _tag: 'error' as const, status: 401}),
    ),
    Effect.catchTag('UnauthorizedError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 403}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

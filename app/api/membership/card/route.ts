import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {MembershipCardService} from '@/src/lib/effect/card.service';
import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const cardService = yield* MembershipCardService;

      // Verify session
      const session = yield* portal.verifySession(sessionCookie);

      // Get existing card
      const card = yield* cardService.getCard(session.uid);

      if (!card) {
        return {hasCard: false, card: null};
      }

      return {hasCard: true, card};
    }),

    Effect.catchTag('SessionError', () =>
      Effect.succeed({error: 'Session expired', _tag: 'error' as const, status: 401}),
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

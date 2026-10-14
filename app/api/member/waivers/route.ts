import {Effect} from 'effect';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';
import {getMemberWaiverContext} from '@/src/lib/waivers/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;
    const session = yield* portal.verifySession(sessionCookie);
    return yield* getMemberWaiverContext(session.uid);
  }).pipe(
    Effect.catchTag('SessionError', () => Effect.succeed({error: 'Session expired', status: 401})),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({error: 'Unable to load waivers', status: 500}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
  if ('error' in result) {
    return NextResponse.json({error: result.error}, {status: result.status});
  }
  return NextResponse.json(result, {headers: {'Cache-Control': 'private, no-store'}});
}

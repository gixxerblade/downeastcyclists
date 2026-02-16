import {Effect, Exit} from 'effect';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;

    // Verify session
    const session = yield* portal.verifySession(sessionCookie);

    // Get dashboard data
    return yield* portal.getMemberDashboard(session.uid);
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));

  if (Exit.isFailure(exit)) {
    const cause = exit.cause;
    const failure = cause._tag === 'Fail' ? cause.error : null;

    if (failure && typeof failure === 'object' && '_tag' in failure) {
      if (failure._tag === 'SessionError') {
        return NextResponse.json({error: 'Session invalid'}, {status: 401});
      }
      if (failure._tag === 'NotFoundError' && 'resource' in failure) {
        return NextResponse.json({error: `${failure.resource} not found`}, {status: 404});
      }
      if (failure._tag === 'DatabaseError' && 'message' in failure) {
        return NextResponse.json({error: failure.message as string}, {status: 500});
      }
    }
    return NextResponse.json({error: 'An unexpected error occurred'}, {status: 500});
  }

  return NextResponse.json(exit.value);
}

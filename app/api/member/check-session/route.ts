import {Effect, Exit} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {FirestoreService} from '@/src/lib/effect/firestore.service';
import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';

/**
 * Check if a user's membership has been created after checkout
 * Used for polling after Stripe redirects back to the site
 */
export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;
    const firestore = yield* FirestoreService;

    // Verify session
    const session = yield* portal.verifySession(sessionCookie);

    // Check if membership exists
    const membership = yield* firestore.getActiveMembership(session.uid);

    return {
      ready: !!membership,
      hasMembership: !!membership,
    };
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));

  if (Exit.isFailure(exit)) {
    // If membership doesn't exist yet, that's okay - return not ready
    return NextResponse.json({ready: false, hasMembership: false});
  }

  return NextResponse.json(exit.value);
}

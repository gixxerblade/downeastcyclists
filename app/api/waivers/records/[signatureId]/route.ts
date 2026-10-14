import {Effect} from 'effect';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {hasDashboardCapability} from '@/src/lib/access-control';
import {AdminService} from '@/src/lib/effect/admin.service';
import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';
import {renderWaiverRecord} from '@/src/lib/waivers/record-html';
import {getWaiverRecord} from '@/src/lib/waivers/service';

export async function GET(_request: Request, context: {params: Promise<{signatureId: string}>}) {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }
  const {signatureId} = await context.params;

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;
    const admin = yield* AdminService;
    const session = yield* portal.verifySession(sessionCookie);
    const access = yield* admin.getAccess(sessionCookie);
    return yield* getWaiverRecord(
      signatureId,
      session.uid,
      hasDashboardCapability(access.role, 'waivers:read'),
    );
  }).pipe(
    Effect.catchTag('SessionError', () => Effect.succeed({error: 'Session expired', status: 401})),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({error: 'Signed waiver not found', status: 404}),
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({error: 'Unable to load signed waiver', status: 500}),
    ),
    Effect.catchTag('AuthError', () =>
      Effect.succeed({error: 'Unable to verify access', status: 401}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
  if ('error' in result) {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  const html = renderWaiverRecord(result);
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

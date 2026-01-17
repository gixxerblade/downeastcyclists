import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {AdminService} from '@/src/lib/effect/admin.service';
import {LiveLayer} from '@/src/lib/effect/layers';
import {StatsService} from '@/src/lib/effect/stats.service';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;
      const stats = yield* StatsService;

      // Verify admin access
      yield* admin.verifyAdmin(sessionCookie);

      // Get stats
      return yield* stats.getStats();
    }),

    Effect.catchTag('UnauthorizedError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 403}),
    ),
    Effect.catchTag('SessionError', () =>
      Effect.succeed({error: 'Session expired', _tag: 'error' as const, status: 401}),
    ),
    Effect.catchTag('AuthError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 401}),
    ),
    Effect.catchTag('FirestoreError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

// Refresh stats
export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;
      const stats = yield* StatsService;

      yield* admin.verifyAdmin(sessionCookie);
      return yield* stats.refreshStats();
    }),

    Effect.catchTag('UnauthorizedError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 403}),
    ),
    Effect.catchTag('SessionError', () =>
      Effect.succeed({error: 'Session expired', _tag: 'error' as const, status: 401}),
    ),
    Effect.catchTag('AuthError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 401}),
    ),
    Effect.catchTag('FirestoreError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

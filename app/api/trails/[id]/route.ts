import {Effect} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {DatabaseError} from '@/src/lib/effect/errors';
import {getFirestoreClient} from '@/src/lib/firestore-client';

export async function PATCH(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!id) {
    return NextResponse.json({error: 'Trail ID is required'}, {status: 400});
  }

  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({error: 'Invalid trail update'}, {status: 400});
  }

  const trailData: Record<string, string | boolean> = {};
  if ('trail' in body) {
    if (typeof body.trail !== 'string') {
      return NextResponse.json({error: 'trail must be a string'}, {status: 400});
    }
    trailData.trail = body.trail;
  }
  if ('open' in body) {
    if (typeof body.open !== 'boolean') {
      return NextResponse.json({error: 'open must be a boolean'}, {status: 400});
    }
    trailData.open = body.open;
  }
  if ('notes' in body) {
    if (typeof body.notes !== 'string') {
      return NextResponse.json({error: 'notes must be a string'}, {status: 400});
    }
    trailData.notes = body.notes;
  }
  if (Object.keys(trailData).length === 0) {
    return NextResponse.json({error: 'No supported trail fields provided'}, {status: 400});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'trails:update');
        const db = getFirestoreClient();
        const trailRef = db.collection('trails').doc(id);
        yield* Effect.tryPromise({
          try: () => trailRef.update(trailData),
          catch: (cause) =>
            new DatabaseError({
              code: 'TRAIL_UPDATE_FAILED',
              message: 'Failed to update trail',
              cause,
            }),
        });
        return {success: true};
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });
}

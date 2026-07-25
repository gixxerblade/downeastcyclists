import {Effect} from 'effect';
import {NextRequest} from 'next/server';
import {z} from 'zod';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {DatabaseError, ValidationError} from '@/src/lib/effect/errors';
import {addTrailMaintenanceNote} from '@/src/lib/trail-maintenance/repository';

interface RouteContext {
  readonly params: Promise<{readonly reportId: string}>;
}

const noteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const {reportId} = await context.params;
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const session = yield* admin.authorize(sessionCookie, 'trail-maintenance:manage');
        const input = yield* Effect.tryPromise({
          try: async () => noteSchema.parse(await request.json()),
          catch: (error) =>
            new ValidationError({
              field: 'body',
              message: error instanceof Error ? error.message : 'Invalid note',
              cause: error,
            }),
        });
        yield* Effect.tryPromise({
          try: () =>
            addTrailMaintenanceNote({
              reportId,
              note: input.note,
              actor: {uid: session.uid, email: session.email},
            }),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_NOTE_FAILED',
              message: 'Failed to add note',
              cause: error,
            }),
        });
        return {ok: true};
      }),
  });
}

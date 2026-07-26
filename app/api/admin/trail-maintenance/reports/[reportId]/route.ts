import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {DatabaseError, NotFoundError, ValidationError} from '@/src/lib/effect/errors';
import {
  getTrailMaintenanceReportDetail,
  updateTrailMaintenanceReport,
} from '@/src/lib/trail-maintenance/repository';
import {trailMaintenanceUpdateSchema} from '@/src/lib/trail-maintenance/validation';

interface RouteContext {
  readonly params: Promise<{readonly reportId: string}>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const {reportId} = await context.params;
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'trail-maintenance:manage');
        const report = yield* Effect.tryPromise({
          try: () => getTrailMaintenanceReportDetail(reportId),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_GET_FAILED',
              message: 'Failed to load trail maintenance report',
              cause: error,
            }),
        });
        if (!report) {
          return yield* Effect.fail(new NotFoundError({resource: 'Trail report', id: reportId}));
        }
        return report;
      }),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const {reportId} = await context.params;
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const session = yield* admin.authorize(sessionCookie, 'trail-maintenance:manage');
        const input = yield* Effect.tryPromise({
          try: async () => trailMaintenanceUpdateSchema.parse(await request.json()),
          catch: (error) =>
            new ValidationError({
              field: 'body',
              message: error instanceof Error ? error.message : 'Invalid update',
              cause: error,
            }),
        });
        yield* Effect.tryPromise({
          try: () =>
            updateTrailMaintenanceReport({
              reportId,
              input,
              actor: {uid: session.uid, email: session.email},
            }),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_UPDATE_FAILED',
              message: 'Failed to update trail maintenance report',
              cause: error,
            }),
        });
        return {ok: true};
      }),
  });
}

import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {DatabaseError, ValidationError} from '@/src/lib/effect/errors';
import {listTrailMaintenanceReports} from '@/src/lib/trail-maintenance/repository';
import {trailMaintenanceListQuerySchema} from '@/src/lib/trail-maintenance/validation';

export async function GET(request: NextRequest) {
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'trail-maintenance:manage');
        const query = yield* Effect.try({
          try: () =>
            trailMaintenanceListQuerySchema.parse({
              status: request.nextUrl.searchParams.get('status') || undefined,
              priority: request.nextUrl.searchParams.get('priority') || undefined,
              issueType: request.nextUrl.searchParams.get('issueType') || undefined,
              page: request.nextUrl.searchParams.get('page') || undefined,
              pageSize: request.nextUrl.searchParams.get('pageSize') || undefined,
            }),
          catch: (error) =>
            new ValidationError({
              field: 'query',
              message: error instanceof Error ? error.message : 'Invalid filters',
              cause: error,
            }),
        });

        return yield* Effect.tryPromise({
          try: () => listTrailMaintenanceReports(query),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_LIST_FAILED',
              message: 'Failed to load trail maintenance reports',
              cause: error,
            }),
        });
      }),
  });
}

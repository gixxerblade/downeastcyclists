import {Effect} from 'effect';
import {NextResponse} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {DatabaseError} from '@/src/lib/effect/errors';
import {generateTrailMaintenanceReportsCsv} from '@/src/lib/trail-maintenance/csv';
import {listTrailMaintenanceReportsForExport} from '@/src/lib/trail-maintenance/repository';

export async function GET() {
  const response = await handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'trail-maintenance:manage');
        const reports = yield* Effect.tryPromise({
          try: () => listTrailMaintenanceReportsForExport(),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_EXPORT_FAILED',
              message: 'Failed to export trail maintenance reports',
              cause: error,
            }),
        });

        return {csv: generateTrailMaintenanceReportsCsv(reports)};
      }),
  });
  const body: unknown = await response.json();

  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return NextResponse.json({error: body.error}, {status: response.status});
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('csv' in body) ||
    typeof body.csv !== 'string'
  ) {
    return NextResponse.json({error: 'Failed to export trail maintenance reports'}, {status: 500});
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`\uFEFF${body.csv}`, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="trail-maintenance-reports-${date}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}

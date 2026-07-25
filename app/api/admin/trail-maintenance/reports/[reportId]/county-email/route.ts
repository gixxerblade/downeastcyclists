import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {DatabaseError, NotFoundError} from '@/src/lib/effect/errors';
import {
  getTrailMaintenanceReportDetail,
  markCountyEmailGenerated,
} from '@/src/lib/trail-maintenance/repository';

interface RouteContext {
  readonly params: Promise<{readonly reportId: string}>;
}

function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const {reportId} = await context.params;
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const session = yield* admin.authorize(sessionCookie, 'trail-maintenance:manage');
        const report = yield* Effect.tryPromise({
          try: () => getTrailMaintenanceReportDetail(reportId),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_COUNTY_DRAFT_LOAD_FAILED',
              message: 'Failed to load trail maintenance report',
              cause: error,
            }),
        });
        if (!report) {
          return yield* Effect.fail(new NotFoundError({resource: 'Trail report', id: reportId}));
        }

        yield* Effect.tryPromise({
          try: () =>
            markCountyEmailGenerated({
              reportId,
              actor: {uid: session.uid, email: session.email},
            }),
          catch: (error) =>
            new DatabaseError({
              code: 'TRAIL_MAINTENANCE_COUNTY_DRAFT_LOG_FAILED',
              message: 'Failed to log county email draft',
              cause: error,
            }),
        });

        const locationLine =
          report.latitude !== null && report.longitude !== null
            ? `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)} (${googleMapsUrl(
                report.latitude,
                report.longitude,
              )})`
            : report.locationNotes || 'Location notes unavailable';

        const subject = `Big Branch Bike Park maintenance issue ${report.publicId}`;
        const body = [
          'Onslow County Parks and Recreation team,',
          '',
          'Down East Cyclists received a trail maintenance report that appears to need county support.',
          '',
          `Report: ${report.publicId}`,
          `Issue: ${report.issueTypeLabel}`,
          `Trail: ${report.trailSystemName}${report.trailSegmentName ? ` - ${report.trailSegmentName}` : ''}`,
          `Observed: ${new Date(report.observedAt).toLocaleString()}`,
          `Location: ${locationLine}`,
          report.description ? `Reporter notes: ${report.description}` : undefined,
          `Photos available: ${report.photoCount}`,
          '',
          'Please let us know if you need additional information from our organizers.',
          '',
          'Down East Cyclists',
        ]
          .filter((line): line is string => line !== undefined)
          .join('\n');

        return {
          to: process.env.ONSLOW_PARKS_EMAIL ?? '',
          subject,
          body,
          mailto: `mailto:${encodeURIComponent(
            process.env.ONSLOW_PARKS_EMAIL ?? '',
          )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        };
      }),
  });
}

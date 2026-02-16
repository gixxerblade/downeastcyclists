import {Schema as S} from 'effect';
import {Effect, pipe} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {ExportService} from '@/src/lib/effect/export.service';
import {ExportOptions} from '@/src/lib/effect/schemas';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await handleAdminRoute({
    handler: (admin, sessionCookie) =>
      pipe(
        // Validate options
        S.decodeUnknown(ExportOptions)(body),
        Effect.mapError(() => ({
          error: 'Invalid export options',
          _tag: 'error' as const,
          status: 400,
        })),

        Effect.flatMap((options) =>
          Effect.gen(function* () {
            const exportService = yield* ExportService;

            // Verify admin access
            yield* admin.verifyAdmin(sessionCookie);

            // Generate export
            if (options.format === 'csv') {
              return {
                data: yield* exportService.generateCSV(options),
                contentType: 'text/csv',
                filename: `members-export-${Date.now()}.csv`,
              };
            } else {
              return {
                data: yield* exportService.generateJSON(options),
                contentType: 'application/json',
                filename: `members-export-${Date.now()}.json`,
              };
            }
          }),
        ),
      ),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError', 'AdminError'],
  });

  // If response is an error JSON, return it as is
  const jsonResponse = await response.json();
  if ('error' in jsonResponse) {
    return NextResponse.json(jsonResponse, {status: response.status});
  }

  // Otherwise, return file download
  const {data, contentType, filename} = jsonResponse as {
    data: string;
    contentType: string;
    filename: string;
  };

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

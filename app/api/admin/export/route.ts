import {Schema as S} from '@effect/schema';
import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {AdminService} from '@/src/lib/effect/admin.service';
import {ExportService} from '@/src/lib/effect/export.service';
import {LiveLayer} from '@/src/lib/effect/layers';
import {ExportOptions} from '@/src/lib/effect/schemas';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const body = await request.json();

  const program = pipe(
    // Validate options
    S.decodeUnknown(ExportOptions)(body),
    Effect.mapError(() => ({
      error: 'Invalid export options',
      _tag: 'error' as const,
      status: 400,
    })),

    Effect.flatMap((options) =>
      Effect.gen(function* () {
        const admin = yield* AdminService;
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
    Effect.catchTag('ExportError', (error) =>
      Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  // Type assertion after error check - we know this is the success case
  const successResult = result as {data: string; contentType: string; filename: string};

  // Return file download
  return new NextResponse(successResult.data, {
    headers: {
      'Content-Type': successResult.contentType,
      'Content-Disposition': `attachment; filename="${successResult.filename}"`,
    },
  });
}

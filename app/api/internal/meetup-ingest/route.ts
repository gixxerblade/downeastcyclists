import {Effect} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {runMeetupIngestion} from '@/src/lib/meetup/ingest';

export const dynamic = 'force-dynamic';

const isAuthorized = (request: NextRequest) => {
  const secret = process.env.MEETUP_INGEST_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-meetup-ingest-secret') === secret
  );
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const result = await Effect.runPromise(
    runMeetupIngestion.pipe(
      Effect.catchAll((error) =>
        Effect.succeed({
          error: error.message,
          _tag: 'error' as const,
          status: 500,
        }),
      ),
    ),
  );

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

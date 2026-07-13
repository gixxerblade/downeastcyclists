import {Effect} from 'effect';

import {runMeetupIngestion} from '../../src/lib/meetup/ingest';

export const config = {
  schedule: '@daily',
};

export default async function handler() {
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
    return Response.json({error: result.error}, {status: result.status});
  }

  return Response.json(result, {
    headers: {'Content-Type': 'application/json'},
  });
}

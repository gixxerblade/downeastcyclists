import {Effect, Layer} from 'effect';

import {DatabaseServiceLive} from '../../src/lib/effect/database.service';
import {EmailServiceLive} from '../../src/lib/effect/email.service';
import {sendScheduledRenewalReminders} from '../../src/lib/effect/renewal-reminders';

export const config = {
  schedule: '@daily',
};

export default async function handler() {
  const layer = Layer.mergeAll(DatabaseServiceLive, EmailServiceLive);
  const result = await Effect.runPromise(
    sendScheduledRenewalReminders.pipe(
      Effect.provide(layer),
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

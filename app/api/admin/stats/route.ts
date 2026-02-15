import {Effect} from 'effect';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {StatsService} from '@/src/lib/effect/stats.service';

export async function GET() {
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const stats = yield* StatsService;
        yield* admin.verifyAdmin(sessionCookie);
        return yield* stats.getStats();
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });
}

// Refresh stats
export async function POST() {
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const stats = yield* StatsService;
        yield* admin.verifyAdmin(sessionCookie);
        return yield* stats.refreshStats();
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });
}

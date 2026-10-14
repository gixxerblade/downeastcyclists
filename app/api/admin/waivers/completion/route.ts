import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {getWaiverCompletion} from '@/src/lib/waivers/service';

export async function GET(request: NextRequest) {
  const templateId = request.nextUrl.searchParams.get('templateId') ?? undefined;
  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'waivers:read');
        return yield* getWaiverCompletion(templateId);
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });
}

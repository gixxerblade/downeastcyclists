import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import type {ActionLogParams} from '@/src/types/admin';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize');

  const params: ActionLogParams = {
    action: (searchParams.get('action') as ActionLogParams['action']) || undefined,
    actor: searchParams.get('actor') || undefined,
    target: searchParams.get('target') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    page: pageParam ? parseInt(pageParam) : 1,
    pageSize: pageSizeParam ? parseInt(pageSizeParam) : 50,
  };

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.authorize(sessionCookie, 'action-log:view');
        return yield* admin.getActionLog(params);
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });
}

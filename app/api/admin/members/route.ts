import {Effect} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import type {MemberSearchParams} from '@/src/lib/effect/schemas';
import type {CreateMemberInput} from '@/src/types/admin';

export async function GET(request: NextRequest) {
  // Parse query params
  const {searchParams} = new URL(request.url);
  const expiringWithinDaysParam = searchParams.get('expiringWithinDays');
  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize');

  const params: MemberSearchParams = {
    query: searchParams.get('query') || undefined,
    status: (searchParams.get('status') as MemberSearchParams['status']) || undefined,
    planType: (searchParams.get('planType') as MemberSearchParams['planType']) || undefined,
    expiringWithinDays: expiringWithinDaysParam ? parseInt(expiringWithinDaysParam) : undefined,
    page: pageParam ? parseInt(pageParam) : 1,
    pageSize: pageSizeParam ? parseInt(pageSizeParam) : 20,
  };

  const response = await handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        // Verify admin access
        yield* admin.verifyAdmin(sessionCookie);

        // Search members
        return yield* admin.searchMembers(params);
      }),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'DatabaseError'],
  });

  // If response is an error JSON, return it as is
  const jsonResponse = await response.json();
  if ('error' in jsonResponse) {
    return NextResponse.json(jsonResponse, {status: response.status});
  }

  // Serialize Firestore Timestamps to ISO strings for JSON response
  const data = jsonResponse as {members: any[]; total: number};
  const serializedResult = {
    members: data.members.map((member: any) => ({
      ...member,
      membership: member.membership
        ? {
            ...member.membership,
            startDate:
              member.membership.startDate?.toDate?.()?.toISOString() || member.membership.startDate,
            endDate:
              member.membership.endDate?.toDate?.()?.toISOString() || member.membership.endDate,
          }
        : null,
    })),
    total: data.total,
  };

  return NextResponse.json(serializedResult);
}

// POST - Create new member
export async function POST(request: NextRequest) {
  const body: CreateMemberInput = await request.json();

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        // Verify admin access
        const adminUser = yield* admin.verifyAdmin(sessionCookie);

        // Create member
        return yield* admin.createMember(body, adminUser.uid, adminUser.email);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'ValidationError',
      'EmailConflictError',
      'CardError',
      'QRError',
    ],
  });
}

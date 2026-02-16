import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import type {DeleteMemberInput, UpdateMemberInput} from '@/src/types/admin';

// GET - Get single member
export async function GET(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.getMember(userId);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'MemberNotFoundError',
    ],
  });
}

// PUT - Update member
export async function PUT(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;
  const body: UpdateMemberInput = await request.json();

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const adminUser = yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.updateMember(userId, body, adminUser.uid, adminUser.email);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'StripeError',
      'ValidationError',
      'MemberNotFoundError',
    ],
  });
}

// DELETE - Soft delete member
export async function DELETE(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;
  const body: DeleteMemberInput = await request.json();

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const adminUser = yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.deleteMember(userId, body, adminUser.uid, adminUser.email);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'StripeError',
      'MemberNotFoundError',
      'StripeSubscriptionActiveError',
    ],
  });
}

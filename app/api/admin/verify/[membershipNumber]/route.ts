import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {MembershipCardService} from '@/src/lib/effect/card.service';

interface RouteParams {
  params: Promise<{membershipNumber: string}>;
}

export async function GET(_request: NextRequest, {params}: RouteParams) {
  const {membershipNumber} = await params;

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const cardService = yield* MembershipCardService;

        // Verify admin access
        yield* admin.verifyAdmin(sessionCookie);

        // Verify membership
        return yield* cardService.verifyMembership(membershipNumber);
      }).pipe(
        Effect.catchTag('NotFoundError', () =>
          Effect.succeed({
            valid: false,
            membershipNumber,
            message: 'Membership not found',
            _tag: 'result' as const,
          }),
        ),
      ),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'FirestoreError'],
  });
}

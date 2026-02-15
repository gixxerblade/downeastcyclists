import {Effect} from 'effect';
import {NextRequest} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import type {RefundRequest} from '@/src/types/admin';

// POST - Issue refund for a payment
export async function POST(request: NextRequest, {params}: {params: Promise<{userId: string}>}) {
  const {userId} = await params;
  const body: RefundRequest = await request.json();

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const adminUser = yield* admin.verifyAdmin(sessionCookie);
        const refund = yield* admin.issueRefund(
          userId,
          body.paymentIntentId,
          adminUser.uid,
          body.amount,
          body.reason,
        );
        return {
          refundId: refund.id,
          status: refund.status,
          amount: refund.amount,
        };
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'DatabaseError',
      'StripeError',
      'MemberNotFoundError',
    ],
  });
}

import {Effect} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';
import {MembershipCardService} from '@/src/lib/effect/card.service';

export async function POST(request: NextRequest) {
  const {qrData} = await request.json();

  if (!qrData) {
    return NextResponse.json({error: 'QR data is required'}, {status: 400});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const cardService = yield* MembershipCardService;

        // Verify admin access
        yield* admin.verifyAdmin(sessionCookie);

        // Verify QR code
        return yield* cardService.verifyQRCode(qrData);
      }).pipe(
        Effect.catchTag('QRError', (error) =>
          Effect.succeed({
            valid: false,
            membershipNumber: '',
            memberName: 'Unknown',
            planType: 'individual' as const,
            status: 'canceled' as const,
            expiresAt: '',
            daysRemaining: 0,
            message: error.message,
          }),
        ),
      ),
    errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'FirestoreError'],
  });
}

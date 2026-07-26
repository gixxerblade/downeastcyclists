import {Schema as S} from 'effect';
import {Effect, pipe} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {getTrustedClientIdentifier} from '@/src/lib/api/client-identity';
import {ValidationError} from '@/src/lib/effect/errors';
import {LiveLayer} from '@/src/lib/effect/layers';
import {MembershipService} from '@/src/lib/effect/membership.service';
import {CheckoutApiRequest} from '@/src/lib/effect/schemas';
import {getFirebaseAdmin} from '@/src/lib/firebase-admin';
import {consumeRateLimit} from '@/src/lib/rate-limit';
import {verifyRenewalToken} from '@/src/lib/renewal-token';

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await consumeRateLimit({
      scope: 'checkout',
      identifier: getTrustedClientIdentifier(request),
      limit: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {error: 'Too many checkout requests. Please wait and try again.'},
        {
          status: 429,
          headers: {
            'Retry-After': String(
              Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
            ),
          },
        },
      );
    }
  } catch (error) {
    console.error('[Checkout] Rate-limit check failed:', error);
    return NextResponse.json({error: 'Checkout is temporarily unavailable'}, {status: 503});
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: 'Invalid request body'}, {status: 400});
  }

  let sessionUserId: string | undefined;
  const sessionCookie = request.cookies.get('session')?.value;
  if (sessionCookie) {
    try {
      const {auth} = getFirebaseAdmin();
      const session = await auth.verifySessionCookie(sessionCookie, true);
      sessionUserId = session.uid;
    } catch {
      sessionUserId = undefined;
    }
  }

  const program = pipe(
    Effect.gen(function* () {
      const validatedRequest = yield* S.decodeUnknown(CheckoutApiRequest)(body).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              field: 'body',
              message: 'Invalid request body',
              cause: error,
            }),
        ),
      );

      let renewalUserId: string | undefined;
      if (validatedRequest.renewalToken) {
        const verification = verifyRenewalToken(validatedRequest.renewalToken);
        if (!verification.ok) {
          return yield* new ValidationError({
            field: 'renewalToken',
            message: 'This renewal link is invalid or has expired',
          });
        }
        renewalUserId = verification.payload.sub;
      }

      if (sessionUserId && renewalUserId && sessionUserId !== renewalUserId) {
        return yield* new ValidationError({
          field: 'renewalToken',
          message: 'This renewal link does not match the signed-in account',
        });
      }

      const membershipService = yield* MembershipService;
      return yield* membershipService.createCheckoutSession({
        priceId: validatedRequest.priceId,
        email: validatedRequest.email,
        successUrl: validatedRequest.successUrl,
        cancelUrl: validatedRequest.cancelUrl,
        coverFees: validatedRequest.coverFees,
        planPrice: validatedRequest.planPrice,
        userId: renewalUserId ?? sessionUserId,
      });
    }),

    // Step 3: Handle specific errors with catchTag
    Effect.catchTag('ValidationError', (error) =>
      Effect.succeed({
        error: error.message,
        field: error.field,
        _tag: 'error' as const,
        status: 400,
      }),
    ),
    Effect.catchTag('StripeError', (error) =>
      Effect.sync(() => console.error('[Checkout] Stripe failure:', error)).pipe(
        Effect.as({
          error: 'Unable to create checkout session',
          _tag: 'error' as const,
          status: 500,
        }),
      ),
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.sync(() => console.error('[Checkout] Database failure:', error)).pipe(
        Effect.as({
          error: 'Unable to create checkout session',
          _tag: 'error' as const,
          status: 500,
        }),
      ),
    ),
  );

  // Run with live services
  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  // Return appropriate response
  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

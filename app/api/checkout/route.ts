import {Schema as S} from '@effect/schema';
import {Effect, pipe} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {ValidationError} from '@/src/lib/effect/errors';
import {LiveLayer} from '@/src/lib/effect/layers';
import {MembershipService} from '@/src/lib/effect/membership.service';
import {CheckoutSessionRequest} from '@/src/lib/effect/schemas';
import {getFirebaseAdmin} from '@/src/lib/firebase-admin';

// Simple in-memory rate limiter for unauthenticated requests
const rateLimitStore = new Map<string, {count: number; resetTime: number}>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute for unauthenticated

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, {count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS});
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  // Check for authentication (optional - allows guest checkout)
  const sessionCookie = request.cookies.get('session')?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    try {
      const {auth} = getFirebaseAdmin();
      await auth.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch {
      // Session invalid - treat as unauthenticated guest checkout
    }
  }

  // Rate limit unauthenticated requests
  if (!isAuthenticated) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        {error: 'Too many checkout requests. Please wait and try again.'},
        {status: 429},
      );
    }
  }

  // Parse request body
  const body = await request.json();

  // Define the Effect program
  const program = pipe(
    // Step 1: Validate input with Effect Schema
    S.decodeUnknown(CheckoutSessionRequest)(body),
    Effect.mapError(
      (error) =>
        new ValidationError({
          field: 'body',
          message: 'Invalid request body',
          cause: error,
        }),
    ),

    // Step 2: Create checkout session
    Effect.flatMap((validatedRequest) =>
      Effect.flatMap(MembershipService, (membershipService) =>
        membershipService.createCheckoutSession(validatedRequest),
      ),
    ),

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
      Effect.succeed({
        error: error.message,
        code: error.code,
        _tag: 'error' as const,
        status: 500,
      }),
    ),
    Effect.catchTag('FirestoreError', (error) =>
      Effect.succeed({
        error: error.message,
        _tag: 'error' as const,
        status: 500,
      }),
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

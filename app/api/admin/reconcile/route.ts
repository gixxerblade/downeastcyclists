import {Effect} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {handleAdminRoute} from '@/src/lib/api/admin-route-handler';

// GET: Validate Stripe vs database for given email
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({error: 'Email parameter required'}, {status: 400});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.validateStripeVsDatabase(email);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'StripeError',
      'DatabaseError',
      'AdminError',
    ],
  });
}

// POST: Execute reconciliation for given email
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {email} = body;

  if (!email) {
    return NextResponse.json({error: 'Email required'}, {status: 400});
  }

  return handleAdminRoute({
    handler: (admin, sessionCookie) =>
      Effect.gen(function* () {
        const {uid} = yield* admin.verifyAdmin(sessionCookie);
        return yield* admin.reconcileMembership(email, uid);
      }),
    errorTags: [
      'UnauthorizedError',
      'SessionError',
      'AuthError',
      'StripeError',
      'DatabaseError',
      'CardError',
      'QRError',
      'AdminError',
    ],
  });
}

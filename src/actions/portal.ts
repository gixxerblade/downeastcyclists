'use server';

import {Effect, Exit} from 'effect';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';

import {LiveLayer} from '@/src/lib/effect/layers';
import {PortalService} from '@/src/lib/effect/portal.service';
import type {MemberDashboardResponse} from '@/src/lib/effect/schemas';
import {verifyRenewalToken} from '@/src/lib/renewal-token';

function dashboardErrorFromExit(exit: Exit.Exit<MemberDashboardResponse, unknown>) {
  if (!Exit.isFailure(exit)) {
    return null;
  }

  const cause = exit.cause;
  const failure = cause._tag === 'Fail' ? cause.error : null;

  if (failure && typeof failure === 'object' && '_tag' in failure) {
    if (failure._tag === 'SessionError') {
      redirect('/login');
    }
    if (failure._tag === 'NotFoundError' && 'resource' in failure) {
      return {error: `${failure.resource} not found`};
    }
    if (failure._tag === 'DatabaseError') {
      return {error: 'Unable to load member information'};
    }
  }

  return {error: 'An unexpected error occurred'};
}

// Get member dashboard data - Effect.gen for complex flow
export async function getMemberDashboard(): Promise<MemberDashboardResponse | {error: string}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;

    // Verify session
    const session = yield* portal.verifySession(sessionCookie);

    // Get dashboard data
    return yield* portal.getMemberDashboard(session.uid);
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));
  const error = dashboardErrorFromExit(exit);

  if (error) {
    return error;
  }

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  return {error: 'An unexpected error occurred'};
}

export async function getRenewalDashboard(
  renewalToken?: string,
): Promise<MemberDashboardResponse | {error: string}> {
  let userId: string;
  if (renewalToken) {
    const verification = verifyRenewalToken(renewalToken);
    if (!verification.ok) {
      return {error: 'This renewal link is invalid or has expired'};
    }
    userId = verification.payload.sub;
  } else {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return {error: 'Please sign in to renew your membership'};
    }

    const sessionProgram = Effect.gen(function* () {
      const portal = yield* PortalService;
      return yield* portal.verifySession(sessionCookie);
    });
    const sessionExit = await Effect.runPromiseExit(sessionProgram.pipe(Effect.provide(LiveLayer)));
    if (Exit.isFailure(sessionExit)) {
      return {error: 'Please sign in to renew your membership'};
    }
    userId = sessionExit.value.uid;
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;
    return yield* portal.getMemberDashboard(userId);
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));
  const error = dashboardErrorFromExit(exit);

  if (error) {
    return error;
  }

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  return {error: 'An unexpected error occurred'};
}

// Redirect to Stripe Customer Portal
export async function redirectToPortal(returnUrl: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;

    // Verify session
    const session = yield* portal.verifySession(sessionCookie);

    // Create portal session
    const result = yield* portal.createPortalSession(session.uid, returnUrl);
    return result.url;
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));

  if (Exit.isFailure(exit)) {
    const cause = exit.cause;
    const failure = cause._tag === 'Fail' ? cause.error : null;

    if (failure && typeof failure === 'object' && '_tag' in failure) {
      if (failure._tag === 'SessionError') {
        redirect('/login');
      }
    }
    // For NotFoundError and StripeError, just return without redirect
    return;
  }

  if (exit.value) {
    redirect(exit.value);
  }
}

import {Context, Effect, Layer, pipe} from 'effect';

import {getPlanNameForType} from '../membership-plans-config';

import {AuthService} from './auth.service';
import {DatabaseService} from './database.service';
import {AuthError, SessionError, StripeError, DatabaseError, NotFoundError} from './errors';
import type {MemberDashboardResponse} from './schemas';
import {StripeService} from './stripe.service';

// Service interface
export interface PortalService {
  readonly verifySession: (
    sessionCookie: string,
  ) => Effect.Effect<{uid: string; email: string | undefined}, SessionError | AuthError>;

  readonly getMemberDashboard: (
    userId: string,
  ) => Effect.Effect<MemberDashboardResponse, DatabaseError | NotFoundError>;

  readonly createPortalSession: (
    userId: string,
    returnUrl: string,
  ) => Effect.Effect<{url: string}, StripeError | DatabaseError | NotFoundError>;

  readonly linkFirebaseToStripe: (
    firebaseUid: string,
    stripeCustomerId: string,
  ) => Effect.Effect<void, DatabaseError>;
}

// Service tag
export const PortalService = Context.GenericTag<PortalService>('PortalService');

// Implementation using Effect.gen for complex orchestration
const make = Effect.gen(function* () {
  const auth = yield* AuthService;
  const stripe = yield* StripeService;
  const db = yield* DatabaseService;

  return PortalService.of({
    // Session verification - simple transform, use Effect.pipe
    verifySession: (sessionCookie) =>
      pipe(
        auth.verifySessionCookie(sessionCookie),
        Effect.map((decoded) => ({
          uid: decoded.uid,
          email: decoded.email,
        })),
      ),

    // Dashboard - complex with multiple dependent calls, use Effect.gen
    getMemberDashboard: (userId) =>
      Effect.gen(function* () {
        // Fetch user
        const user = yield* db.getUser(userId);
        if (!user) {
          return yield* new NotFoundError({resource: 'user', id: userId});
        }

        // Fetch membership
        const membership = yield* db.getActiveMembership(userId);

        let membershipData: MemberDashboardResponse['membership'] = null;
        let canManageSubscription = false;

        if (membership) {
          // Dates are ISO strings from Postgres
          const endDate = new Date(membership.endDate as string);
          const now = new Date();
          const daysRemaining = Math.max(
            0,
            Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          );

          const planName = getPlanNameForType(membership.planType);

          const startDate = new Date(membership.startDate as string);

          membershipData = {
            planType: membership.planType,
            planName,
            status: membership.status,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            autoRenew: membership.autoRenew,
            daysRemaining,
          };

          canManageSubscription = !!user.stripeCustomerId;
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name || null,
          },
          membership: membershipData,
          canManageSubscription,
        };
      }),

    // Portal session - sequential dependent calls, use Effect.gen
    createPortalSession: (userId, returnUrl) =>
      Effect.gen(function* () {
        // Get user to find Stripe customer ID
        const user = yield* db.getUser(userId);

        if (!user) {
          return yield* new NotFoundError({resource: 'user', id: userId});
        }

        if (!user.stripeCustomerId) {
          return yield* new NotFoundError({
            resource: 'stripeCustomer',
            id: userId,
          });
        }

        // Create portal session
        const session = yield* stripe.createPortalSession(user.stripeCustomerId, returnUrl);

        yield* Effect.log(`Portal session created for user ${userId}: ${session.id}`);

        return {url: session.url};
      }),

    // Simple delegation, use Effect.pipe
    linkFirebaseToStripe: (firebaseUid, stripeCustomerId) =>
      db.setUser(firebaseUid, {stripeCustomerId}),
  });
});

// Live layer - requires AuthService, StripeService, DatabaseService
export const PortalServiceLive = Layer.effect(PortalService, make);

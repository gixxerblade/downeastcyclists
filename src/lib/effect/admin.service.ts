import {Context, Effect, Layer, pipe} from 'effect';

import {AuthService} from './auth.service';
import {MembershipCardService} from './card.service';
import {
  AdminError,
  CardError,
  FirestoreError,
  NotFoundError,
  QRError,
  StripeError,
  UnauthorizedError,
  SessionError,
  AuthError,
} from './errors';
import {FirestoreService} from './firestore.service';
import type {
  DiscrepancyType,
  FirebaseDataSnapshot,
  MembershipAdjustment,
  MembershipStatus,
  MemberWithMembership,
  MemberSearchParams,
  ReconciliationReport,
  ReconciliationResult,
  StripeDataSnapshot,
} from './schemas';
import {StatsService} from './stats.service';
import {StripeService} from './stripe.service';

// Service interface
export interface AdminService {
  readonly verifyAdmin: (
    sessionCookie: string,
  ) => Effect.Effect<{uid: string; email?: string}, UnauthorizedError | SessionError | AuthError>;

  readonly setAdminRole: (
    adminSessionCookie: string,
    targetUid: string,
    isAdmin: boolean,
  ) => Effect.Effect<
    void,
    UnauthorizedError | AdminError | SessionError | AuthError | FirestoreError
  >;

  readonly searchMembers: (
    params: MemberSearchParams,
  ) => Effect.Effect<{members: MemberWithMembership[]; total: number}, FirestoreError>;

  readonly getMember: (
    userId: string,
  ) => Effect.Effect<MemberWithMembership, FirestoreError | NotFoundError>;

  readonly adjustMembership: (
    adminUid: string,
    adjustment: MembershipAdjustment,
  ) => Effect.Effect<void, FirestoreError | NotFoundError | AdminError>;

  readonly validateStripeVsFirebase: (
    email: string,
  ) => Effect.Effect<ReconciliationReport, AdminError | StripeError | FirestoreError>;

  readonly reconcileMembership: (
    email: string,
    adminUid?: string,
  ) => Effect.Effect<
    ReconciliationResult,
    AdminError | StripeError | FirestoreError | CardError | QRError
  >;
}

// Service tag
export const AdminService = Context.GenericTag<AdminService>('AdminService');

// Admin email whitelist for defense in depth
// Loaded from ADMIN_EMAIL_WHITELIST env var (comma-separated list)
const getAdminWhitelist = (): string[] => {
  const whitelist = process.env.ADMIN_EMAIL_WHITELIST;
  if (!whitelist) {
    return [];
  }
  return whitelist.split(',').map((email) => email.trim().toLowerCase());
};

const isEmailInAdminWhitelist = (email: string | undefined): boolean => {
  if (!email) return false;
  const whitelist = getAdminWhitelist();
  // If no whitelist is configured, fall back to claim-only verification
  if (whitelist.length === 0) return true;
  return whitelist.includes(email.toLowerCase());
};

// Helper functions for reconciliation

function resolvePlanType(priceId: string): 'individual' | 'family' {
  if (priceId === process.env.STRIPE_PRICE_FAMILY) {
    return 'family';
  }
  return 'individual';
}

function formatTimestamp(timestamp: unknown): string {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as {toDate: () => Date}).toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date(timestamp as number).toISOString();
}

function detectDiscrepancies(
  stripeData: StripeDataSnapshot | null,
  firebaseData: FirebaseDataSnapshot | null,
): DiscrepancyType[] {
  const discrepancies: DiscrepancyType[] = [];

  // No Stripe data
  if (!stripeData) {
    discrepancies.push('NO_STRIPE_CUSTOMER');
    return discrepancies;
  }

  // No Firebase user
  if (!firebaseData) {
    discrepancies.push('MISSING_FIREBASE_USER');
    discrepancies.push('MISSING_FIREBASE_MEMBERSHIP');
    discrepancies.push('MISSING_FIREBASE_CARD');
    return discrepancies;
  }

  // Missing membership
  if (!firebaseData.membership) {
    discrepancies.push('MISSING_FIREBASE_MEMBERSHIP');
  } else {
    // Status mismatch
    if (firebaseData.membership.status !== stripeData.subscriptionStatus) {
      discrepancies.push('STATUS_MISMATCH');
    }

    // Plan mismatch
    if (firebaseData.membership.planType !== stripeData.planType) {
      discrepancies.push('PLAN_MISMATCH');
    }

    // Date mismatch (compare dates, allow 1 day tolerance)
    const stripeEnd = new Date(stripeData.currentPeriodEnd).getTime();
    const firebaseEnd = new Date(firebaseData.membership.endDate).getTime();
    if (Math.abs(stripeEnd - firebaseEnd) > 86400000) {
      // 1 day in ms
      discrepancies.push('DATE_MISMATCH');
    }
  }

  // Missing card
  if (!firebaseData.card) {
    discrepancies.push('MISSING_FIREBASE_CARD');
  } else if (firebaseData.membership) {
    // Card/membership mismatches
    if (firebaseData.card.status !== firebaseData.membership.status) {
      discrepancies.push('CARD_STATUS_MISMATCH');
    }
    if (firebaseData.card.planType !== firebaseData.membership.planType) {
      discrepancies.push('CARD_STATUS_MISMATCH');
    }
    // Card dates mismatch (compare card validUntil with membership endDate, 1 day tolerance)
    const cardValidUntil = new Date(firebaseData.card.validUntil).getTime();
    const membershipEndDate = new Date(firebaseData.membership.endDate).getTime();
    if (Math.abs(cardValidUntil - membershipEndDate) > 86400000) {
      discrepancies.push('CARD_DATES_MISMATCH');
    }
  }

  if (discrepancies.length === 0) {
    discrepancies.push('NO_DISCREPANCY');
  }

  return discrepancies;
}

function generateReconcileActions(
  discrepancies: DiscrepancyType[],
  stripeData: StripeDataSnapshot | null,
  firebaseData: FirebaseDataSnapshot | null,
): string[] {
  const actions: string[] = [];

  if (!stripeData) {
    return ['No action possible - no Stripe subscription found'];
  }

  if (discrepancies.includes('MISSING_FIREBASE_USER')) {
    actions.push('Create Firebase user linked to Stripe customer');
  }

  if (discrepancies.includes('MISSING_FIREBASE_MEMBERSHIP')) {
    actions.push(`Create membership document with status: ${stripeData.subscriptionStatus}`);
  }

  if (discrepancies.includes('STATUS_MISMATCH')) {
    actions.push(
      `Update membership status: ${firebaseData?.membership?.status} → ${stripeData.subscriptionStatus}`,
    );
  }

  if (discrepancies.includes('DATE_MISMATCH')) {
    actions.push(
      `Update membership end date to: ${new Date(stripeData.currentPeriodEnd).toLocaleDateString()}`,
    );
  }

  if (discrepancies.includes('PLAN_MISMATCH')) {
    actions.push(
      `Update membership plan type: ${firebaseData?.membership?.planType} → ${stripeData.planType}`,
    );
  }

  if (discrepancies.includes('MISSING_FIREBASE_CARD')) {
    actions.push('Generate new membership card with QR code');
  }

  if (
    discrepancies.includes('CARD_STATUS_MISMATCH') ||
    discrepancies.includes('CARD_DATES_MISMATCH')
  ) {
    actions.push('Update card to match membership (preserve membership number)');
  }

  return actions;
}

// Implementation
const make = Effect.gen(function* () {
  const auth = yield* AuthService;
  const firestore = yield* FirestoreService;
  const stats = yield* StatsService;
  const stripe = yield* StripeService;
  const cardService = yield* MembershipCardService;

  // Shared helper function to build reconciliation report
  // This avoids code duplication between validateStripeVsFirebase and reconcileMembership
  const buildReconciliationReport = (
    email: string,
  ): Effect.Effect<ReconciliationReport, StripeError | FirestoreError> =>
    Effect.gen(function* () {
      // Fetch Stripe data
      const stripeCustomer = yield* stripe.getCustomerByEmail(email);
      let stripeData: StripeDataSnapshot | null = null;

      if (stripeCustomer) {
        const subscriptions = yield* stripe.listCustomerSubscriptions(stripeCustomer.id);
        const activeSubscription =
          subscriptions.find((sub) => sub.status === 'active' || sub.status === 'past_due') ||
          subscriptions[0];

        if (activeSubscription) {
          const priceId = activeSubscription.items.data[0]?.price.id || '';
          const subscriptionData = activeSubscription as unknown as Record<string, unknown>;
          stripeData = {
            customerId: stripeCustomer.id,
            customerEmail: stripeCustomer.email || email,
            subscriptionId: activeSubscription.id,
            subscriptionStatus: activeSubscription.status,
            priceId,
            planType: resolvePlanType(priceId),
            currentPeriodStart: new Date(
              (subscriptionData.current_period_start as number) * 1000,
            ).toISOString(),
            currentPeriodEnd: new Date(
              (subscriptionData.current_period_end as number) * 1000,
            ).toISOString(),
            cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
          };
        }
      }

      // Fetch Firebase data
      const firebaseUser = yield* firestore.getUserByEmail(email);
      let firebaseData: FirebaseDataSnapshot | null = null;

      if (firebaseUser) {
        const membership = yield* firestore.getActiveMembership(firebaseUser.id);
        const card = yield* firestore.getMembershipCard(firebaseUser.id);

        firebaseData = {
          userId: firebaseUser.id,
          userEmail: firebaseUser.email,
          membership: membership
            ? {
                id: membership.id,
                stripeSubscriptionId: membership.stripeSubscriptionId,
                status: membership.status,
                planType: membership.planType,
                startDate: formatTimestamp(membership.startDate),
                endDate: formatTimestamp(membership.endDate),
                autoRenew: membership.autoRenew,
              }
            : null,
          card: card
            ? {
                membershipNumber: card.membershipNumber,
                status: card.status,
                planType: card.planType,
                validFrom: card.validFrom,
                validUntil: card.validUntil,
              }
            : null,
        };
      }

      // Detect discrepancies
      const discrepancies = detectDiscrepancies(stripeData, firebaseData);
      const reconcileActions = generateReconcileActions(discrepancies, stripeData, firebaseData);

      return {
        email,
        stripeData,
        firebaseData,
        discrepancies,
        canReconcile:
          stripeData !== null &&
          discrepancies.length > 0 &&
          !discrepancies.includes('NO_STRIPE_SUBSCRIPTION'),
        reconcileActions,
      };
    });

  return AdminService.of({
    // Verify admin access with defense in depth (claim + whitelist)
    verifyAdmin: (sessionCookie) =>
      pipe(
        auth.verifyAdminClaim(sessionCookie),
        Effect.flatMap((session) => {
          // First check: admin claim must be true
          if (!session.isAdmin) {
            return Effect.fail(
              new UnauthorizedError({
                message: 'Admin access required',
              }),
            );
          }

          // Second check: email must be in whitelist (if whitelist is configured)
          if (!isEmailInAdminWhitelist(session.email)) {
            return Effect.fail(
              new UnauthorizedError({
                message: 'Admin email not in authorized whitelist',
              }),
            );
          }

          return Effect.succeed({uid: session.uid, email: session.email});
        }),
      ),

    // Set admin role for a user
    setAdminRole: (adminSessionCookie, targetUid, isAdmin) =>
      Effect.gen(function* () {
        // Verify caller is admin
        const admin = yield* pipe(
          auth.verifyAdminClaim(adminSessionCookie),
          Effect.flatMap((session) =>
            session.isAdmin
              ? Effect.succeed(session)
              : Effect.fail(new UnauthorizedError({message: 'Admin access required'})),
          ),
        );

        // Set custom claim
        yield* auth.setCustomClaims(targetUid, {admin: isAdmin});

        // Log the action
        yield* firestore.logAuditEntry(targetUid, 'ADMIN_ROLE_CHANGE', {
          changedBy: admin.uid,
          newValue: isAdmin,
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(
          `Admin role ${isAdmin ? 'granted to' : 'revoked from'} ${targetUid} by ${admin.uid}`,
        );
      }),

    // Search members
    searchMembers: (params) => firestore.getAllMemberships(params),

    // Get single member
    getMember: (userId) =>
      Effect.gen(function* () {
        const user = yield* firestore.getUser(userId);

        if (!user) {
          return yield* Effect.fail(new NotFoundError({resource: 'user', id: userId}));
        }

        const membership = yield* firestore.getActiveMembership(userId);
        const card = yield* firestore.getMembershipCard(userId);

        return {user, membership, card};
      }),

    // Adjust membership (admin override)
    adjustMembership: (adminUid, adjustment) =>
      Effect.gen(function* () {
        const {userId, membershipId, newEndDate, newStatus, reason} = adjustment;

        // Verify membership exists
        const membership = yield* firestore.getMembership(userId, membershipId);

        if (!membership) {
          return yield* Effect.fail(new NotFoundError({resource: 'membership', id: membershipId}));
        }

        // Prepare update
        const updateData: Record<string, unknown> = {};

        if (newEndDate) {
          updateData.endDate = new Date(newEndDate);
        }

        if (newStatus) {
          updateData.status = newStatus;

          // Update stats if status changed
          if (membership.status !== newStatus) {
            if (newStatus === 'active') {
              yield* stats.incrementStat('activeMembers');
              if (membership.status === 'canceled') {
                yield* stats.decrementStat('canceledMembers');
              }
            } else if (newStatus === 'canceled') {
              yield* stats.incrementStat('canceledMembers');
              if (membership.status === 'active') {
                yield* stats.decrementStat('activeMembers');
              }
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          return yield* Effect.fail(
            new AdminError({
              code: 'NO_CHANGES',
              message: 'No changes specified',
            }),
          );
        }

        // Apply update
        yield* firestore.updateMembership(userId, membershipId, updateData);

        // Log audit entry
        yield* firestore.logAuditEntry(userId, 'MEMBERSHIP_ADJUSTMENT', {
          adjustedBy: adminUid,
          membershipId,
          changes: updateData,
          reason,
          previousValues: {
            status: membership.status,
            endDate: membership.endDate,
          },
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(`Membership ${membershipId} adjusted by admin ${adminUid}: ${reason}`);
      }),

    // Validate Stripe vs Firebase data
    validateStripeVsFirebase: (email) => buildReconciliationReport(email),

    // Execute reconciliation
    reconcileMembership: (email, adminUid) =>
      Effect.gen(function* () {
        // Reuse buildReconciliationReport to get current state (avoids code duplication)
        const report = yield* buildReconciliationReport(email);

        if (!report.canReconcile || !report.stripeData) {
          return {
            success: false,
            email,
            actionsPerformed: [],
            membershipUpdated: false,
            cardUpdated: false,
            cardCreated: false,
            userCreated: false,
            error: 'Cannot reconcile: No active Stripe subscription found',
          };
        }

        const actionsPerformed: string[] = [];
        let userCreated = false;
        let membershipUpdated = false;
        let cardUpdated = false;
        let cardCreated = false;

        const stripeDataValue = report.stripeData;

        // Step 1: Ensure user exists
        let userId: string;
        if (!report.firebaseData) {
          // Create user
          const newUser = yield* firestore.upsertUserByStripeCustomer(
            stripeDataValue.customerId,
            stripeDataValue.customerEmail,
            {},
          );
          userId = newUser.id;
          userCreated = true;
          actionsPerformed.push(`Created Firebase user: ${userId}`);
        } else {
          userId = report.firebaseData.userId;
        }

        // Step 2: Create or update membership document
        const membershipData = {
          stripeSubscriptionId: stripeDataValue.subscriptionId,
          planType: stripeDataValue.planType,
          status: stripeDataValue.subscriptionStatus as MembershipStatus,
          startDate: new Date(stripeDataValue.currentPeriodStart),
          endDate: new Date(stripeDataValue.currentPeriodEnd),
          autoRenew: !stripeDataValue.cancelAtPeriodEnd,
          createdAt: null as unknown, // Overwritten by serverTimestamp in implementation
          updatedAt: null as unknown, // Overwritten by serverTimestamp in implementation
        };

        if (!report.firebaseData?.membership) {
          yield* firestore.setMembership(userId, stripeDataValue.subscriptionId, membershipData);
          actionsPerformed.push(`Created membership: ${stripeDataValue.subscriptionId}`);
        } else {
          yield* firestore.updateMembership(userId, stripeDataValue.subscriptionId, membershipData);
          actionsPerformed.push(`Updated membership: ${stripeDataValue.subscriptionId}`);
        }
        membershipUpdated = true;

        // Step 3: Create or update card document
        const user = yield* firestore.getUser(userId);
        const membership = yield* firestore.getMembership(userId, stripeDataValue.subscriptionId);

        if (user && membership) {
          if (!report.firebaseData?.card) {
            // Create new card
            yield* cardService.createCard({userId, user, membership});
            cardCreated = true;
            actionsPerformed.push('Created membership card with new number');
          } else {
            // Update existing card
            yield* cardService.updateCard({userId, user, membership});
            cardUpdated = true;
            actionsPerformed.push('Updated membership card (preserved number)');
          }
        }

        // Step 4: Log audit entry
        yield* firestore.logAuditEntry(userId, 'RECONCILIATION', {
          stripeSubscriptionId: stripeDataValue.subscriptionId,
          discrepanciesFixed: report.discrepancies,
          actionsPerformed,
          performedBy: adminUid || 'admin',
        });

        return {
          success: true,
          email,
          actionsPerformed,
          membershipUpdated,
          cardUpdated,
          cardCreated,
          userCreated,
        };
      }),
  });
});

// Live layer
export const AdminServiceLive = Layer.effect(AdminService, make);

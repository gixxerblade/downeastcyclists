import {Context, Effect, Layer, pipe} from 'effect';
import type Stripe from 'stripe';

import type {
  AuditEntry,
  BulkImportResult,
  BulkImportRow,
  CreateMemberInput,
  DeleteMemberInput,
  ExpiringMember,
  PaymentHistoryItem,
  UpdateMemberInput,
} from '@/src/types/admin';

import {AuthService} from './auth.service';
import {MembershipCardService} from './card.service';
import {DatabaseService} from './database.service';
import {
  AdminError,
  CardError,
  DatabaseError,
  EmailConflictError,
  ImportError,
  MemberNotFoundError,
  NotFoundError,
  QRError,
  StripeError,
  StripeSubscriptionActiveError,
  UnauthorizedError,
  SessionError,
  AuthError,
  ValidationError,
} from './errors';
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
    UnauthorizedError | AdminError | SessionError | AuthError | DatabaseError
  >;

  readonly searchMembers: (
    params: MemberSearchParams,
  ) => Effect.Effect<{members: MemberWithMembership[]; total: number}, DatabaseError>;

  readonly getMember: (
    userId: string,
  ) => Effect.Effect<MemberWithMembership, DatabaseError | NotFoundError>;

  readonly adjustMembership: (
    adminUid: string,
    adjustment: MembershipAdjustment,
  ) => Effect.Effect<void, DatabaseError | NotFoundError | AdminError>;

  readonly validateStripeVsFirebase: (
    email: string,
  ) => Effect.Effect<ReconciliationReport, AdminError | StripeError | DatabaseError>;

  readonly reconcileMembership: (
    email: string,
    adminUid?: string,
  ) => Effect.Effect<
    ReconciliationResult,
    AdminError | StripeError | DatabaseError | CardError | QRError
  >;

  // Member CRUD operations
  readonly createMember: (
    input: CreateMemberInput,
    adminUid: string,
    adminEmail?: string,
  ) => Effect.Effect<
    {userId: string; membershipId: string; membershipNumber: string},
    ValidationError | EmailConflictError | DatabaseError | AuthError | CardError | QRError
  >;

  readonly updateMember: (
    userId: string,
    input: UpdateMemberInput,
    adminUid: string,
    adminEmail?: string,
  ) => Effect.Effect<
    {emailSyncedToStripe?: boolean; emailSyncedToAuth?: boolean},
    | MemberNotFoundError
    | ValidationError
    | DatabaseError
    | StripeError
    | AuthError
    | CardError
    | QRError
  >;

  readonly deleteMember: (
    userId: string,
    input: DeleteMemberInput,
    adminUid: string,
    adminEmail?: string,
  ) => Effect.Effect<
    {stripeSubscriptionCanceled?: boolean},
    MemberNotFoundError | StripeSubscriptionActiveError | DatabaseError | StripeError
  >;

  readonly bulkImportMembers: (
    rows: BulkImportRow[],
    adminUid: string,
    adminEmail?: string,
  ) => Effect.Effect<
    BulkImportResult,
    ImportError | DatabaseError | AuthError | CardError | QRError
  >;

  readonly getExpiringMemberships: (
    withinDays: 30 | 60 | 90,
  ) => Effect.Effect<ExpiringMember[], DatabaseError>;

  readonly getMemberAuditLog: (
    userId: string,
  ) => Effect.Effect<AuditEntry[], MemberNotFoundError | DatabaseError>;

  readonly getPaymentHistory: (
    userId: string,
  ) => Effect.Effect<PaymentHistoryItem[], MemberNotFoundError | StripeError | DatabaseError>;

  readonly issueRefund: (
    userId: string,
    paymentIntentId: string,
    adminUid: string,
    amount?: number,
    reason?: string,
  ) => Effect.Effect<Stripe.Refund, MemberNotFoundError | StripeError | DatabaseError>;
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
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
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
  const db = yield* DatabaseService;
  const stats = yield* StatsService;
  const stripe = yield* StripeService;
  const cardService = yield* MembershipCardService;

  // Shared helper function to build reconciliation report
  // This avoids code duplication between validateStripeVsFirebase and reconcileMembership
  const buildReconciliationReport = (
    email: string,
  ): Effect.Effect<ReconciliationReport, StripeError | DatabaseError> =>
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

          // Safely convert timestamps to ISO strings
          const periodStart = subscriptionData.current_period_start as number | undefined;
          const periodEnd = subscriptionData.current_period_end as number | undefined;

          if (!periodStart || !periodEnd) {
            return yield* new StripeError({
              code: 'INVALID_SUBSCRIPTION_DATA',
              message: `Subscription ${activeSubscription.id} missing period dates`,
            });
          }

          stripeData = {
            customerId: stripeCustomer.id,
            customerEmail: stripeCustomer.email || email,
            subscriptionId: activeSubscription.id,
            subscriptionStatus: activeSubscription.status,
            priceId,
            planType: resolvePlanType(priceId),
            currentPeriodStart: new Date(periodStart * 1000).toISOString(),
            currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
            cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
          };
        }
      }

      // Fetch database data
      const dbUser = yield* db.getUserByEmail(email);
      let firebaseData: FirebaseDataSnapshot | null = null;

      if (dbUser) {
        const membership = yield* db.getActiveMembership(dbUser.id);
        const card = yield* db.getMembershipCard(dbUser.id);

        firebaseData = {
          userId: dbUser.id,
          userEmail: dbUser.email,
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
        yield* db.logAuditEntry(targetUid, 'ADMIN_ROLE_CHANGE', {
          changedBy: admin.uid,
          newValue: isAdmin,
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(
          `Admin role ${isAdmin ? 'granted to' : 'revoked from'} ${targetUid} by ${admin.uid}`,
        );
      }),

    // Search members
    searchMembers: (params) => db.getAllMemberships(params),

    // Get single member
    getMember: (userId) =>
      Effect.gen(function* () {
        const user = yield* db.getUser(userId);

        if (!user) {
          return yield* new NotFoundError({resource: 'user', id: userId});
        }

        const membership = yield* db.getActiveMembership(userId);
        const card = yield* db.getMembershipCard(userId);

        return {user, membership, card};
      }),

    // Adjust membership (admin override)
    adjustMembership: (adminUid, adjustment) =>
      Effect.gen(function* () {
        const {userId, membershipId, newEndDate, newStatus, reason} = adjustment;

        // Verify membership exists
        const membership = yield* db.getMembership(userId, membershipId);

        if (!membership) {
          return yield* new NotFoundError({resource: 'membership', id: membershipId});
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
          return yield* new AdminError({
            code: 'NO_CHANGES',
            message: 'No changes specified',
          });
        }

        // Apply update
        yield* db.updateMembership(userId, membershipId, updateData);

        // Log audit entry
        yield* db.logAuditEntry(userId, 'MEMBERSHIP_ADJUSTMENT', {
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

    // Validate Stripe vs database data
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
          const newUser = yield* db.upsertUserByStripeCustomer(
            stripeDataValue.customerId,
            stripeDataValue.customerEmail,
            {},
          );
          userId = newUser.id;
          userCreated = true;
          actionsPerformed.push(`Created user: ${userId}`);
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
          createdAt: null as unknown, // Overwritten by database layer
          updatedAt: null as unknown, // Overwritten by database layer
        };

        if (!report.firebaseData?.membership) {
          yield* db.setMembership(userId, stripeDataValue.subscriptionId, membershipData);
          actionsPerformed.push(`Created membership: ${stripeDataValue.subscriptionId}`);
        } else {
          yield* db.updateMembership(userId, stripeDataValue.subscriptionId, membershipData);
          actionsPerformed.push(`Updated membership: ${stripeDataValue.subscriptionId}`);
        }
        membershipUpdated = true;

        // Step 3: Create or update card document
        const user = yield* db.getUser(userId);
        const membership = yield* db.getMembership(userId, stripeDataValue.subscriptionId);

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
        yield* db.logAuditEntry(userId, 'RECONCILIATION', {
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

    // Create member manually
    createMember: (input, adminUid, adminEmail) =>
      Effect.gen(function* () {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.email)) {
          return yield* new ValidationError({
            field: 'email',
            message: 'Invalid email format',
          });
        }

        // Validate dates
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return yield* new ValidationError({
            field: 'dates',
            message: 'Invalid date format',
          });
        }
        if (endDate <= startDate) {
          return yield* new ValidationError({
            field: 'endDate',
            message: 'End date must be after start date',
          });
        }

        // Check if email already exists in database
        const existingUser = yield* db.getUserByEmail(input.email);
        if (existingUser) {
          return yield* new EmailConflictError({
            email: input.email,
            message: 'A member with this email already exists',
          });
        }

        // Check if email exists in Firebase Auth
        const existingAuthUser = yield* auth.getUserByEmail(input.email);
        let userId: string;

        if (existingAuthUser) {
          userId = existingAuthUser.uid;
        } else {
          // Create Firebase Auth user
          const newAuthUser = yield* auth.createAuthUser(input.email, input.name);
          userId = newAuthUser.uid;
        }

        // Create user document in database
        yield* db.createUser(userId, {
          email: input.email,
          name: input.name,
          phone: input.phone,
          stripeCustomerId: input.stripeCustomerId,
        });

        // Generate membership ID
        const membershipId = `manual_${Date.now()}`;

        // Map status to valid MembershipStatus
        const membershipStatus: MembershipStatus =
          input.status === 'complimentary' || input.status === 'legacy' ? 'active' : input.status;

        // Create membership document
        yield* db.setMembership(userId, membershipId, {
          stripeSubscriptionId: membershipId,
          planType: input.planType,
          status: membershipStatus,
          startDate,
          endDate,
          autoRenew: false,
          createdAt: null as unknown,
          updatedAt: null as unknown,
        });

        // Get user and membership for card creation
        const user = yield* db.getUser(userId);
        const membership = yield* db.getMembership(userId, membershipId);

        if (!user || !membership) {
          return yield* new DatabaseError({
            code: 'DATA_NOT_FOUND',
            message: 'Failed to retrieve created user or membership',
          });
        }

        // Create membership card
        const cardResult = yield* cardService.createCard({userId, user, membership});
        const membershipNumber = cardResult.membershipNumber;

        // Update stats
        yield* stats.incrementStat('totalMembers');
        yield* stats.incrementStat('activeMembers');
        if (input.planType === 'individual') {
          yield* stats.incrementStat('individualCount');
        } else {
          yield* stats.incrementStat('familyCount');
        }

        // Log audit entry
        yield* db.logAuditEntry(userId, 'MEMBER_CREATED', {
          performedBy: adminUid,
          performedByEmail: adminEmail,
          newValues: {
            email: input.email,
            name: input.name,
            planType: input.planType,
            status: input.status,
            startDate: input.startDate,
            endDate: input.endDate,
            notes: input.notes,
          },
          timestamp: new Date().toISOString(),
        });

        return {userId, membershipId, membershipNumber};
      }),

    // Update member
    updateMember: (userId, input, adminUid, adminEmail) =>
      Effect.gen(function* () {
        // Get existing user
        const existingUser = yield* db.getUser(userId);
        if (!existingUser) {
          return yield* new MemberNotFoundError({
            userId,
            message: 'Member not found',
          });
        }

        const previousValues: Record<string, unknown> = {};
        const newValues: Record<string, unknown> = {};
        let emailSyncedToStripe = false;
        let emailSyncedToAuth = false;

        // Update user fields
        const userUpdates: Record<string, unknown> = {};

        if (input.email && input.email !== existingUser.email) {
          previousValues.email = existingUser.email;
          newValues.email = input.email;
          userUpdates.email = input.email;

          // Sync email to Stripe if customer exists
          if (existingUser.stripeCustomerId) {
            yield* stripe.updateCustomerEmail(existingUser.stripeCustomerId, input.email);
            emailSyncedToStripe = true;
          }

          // Update Firebase Auth email
          yield* auth.updateUserEmail(userId, input.email);
          emailSyncedToAuth = true;
        }

        if (input.name !== undefined && input.name !== existingUser.name) {
          previousValues.name = existingUser.name;
          newValues.name = input.name;
          userUpdates.name = input.name;
        }

        if (input.phone !== undefined && input.phone !== existingUser.phone) {
          previousValues.phone = existingUser.phone;
          newValues.phone = input.phone;
          userUpdates.phone = input.phone;
        }

        if (input.stripeCustomerId !== undefined) {
          previousValues.stripeCustomerId = existingUser.stripeCustomerId;
          newValues.stripeCustomerId = input.stripeCustomerId;
          userUpdates.stripeCustomerId = input.stripeCustomerId;
        }

        if (Object.keys(userUpdates).length > 0) {
          yield* db.updateUser(userId, userUpdates);
        }

        // Update membership if needed
        const activeMembership = yield* db.getActiveMembership(userId);
        if (activeMembership) {
          const membershipUpdates: Record<string, unknown> = {};

          if (input.planType && input.planType !== activeMembership.planType) {
            previousValues.planType = activeMembership.planType;
            newValues.planType = input.planType;
            membershipUpdates.planType = input.planType;

            // Update stats
            if (activeMembership.planType === 'individual') {
              yield* stats.decrementStat('individualCount');
            } else {
              yield* stats.decrementStat('familyCount');
            }
            if (input.planType === 'individual') {
              yield* stats.incrementStat('individualCount');
            } else {
              yield* stats.incrementStat('familyCount');
            }
          }

          if (input.status && input.status !== activeMembership.status) {
            previousValues.status = activeMembership.status;
            newValues.status = input.status;
            membershipUpdates.status = input.status;

            // Update stats for status changes
            if (
              activeMembership.status === 'active' &&
              input.status !== 'active' &&
              input.status !== 'past_due'
            ) {
              yield* stats.decrementStat('activeMembers');
              if (input.status === 'canceled') {
                yield* stats.incrementStat('canceledMembers');
              }
            } else if (
              activeMembership.status !== 'active' &&
              (input.status === 'active' || input.status === 'past_due')
            ) {
              yield* stats.incrementStat('activeMembers');
              if (activeMembership.status === 'canceled') {
                yield* stats.decrementStat('canceledMembers');
              }
            }
          }

          if (input.startDate) {
            const startDate = new Date(input.startDate);
            previousValues.startDate = activeMembership.startDate;
            newValues.startDate = input.startDate;
            membershipUpdates.startDate = startDate;
          }

          if (input.endDate) {
            const endDate = new Date(input.endDate);
            previousValues.endDate = activeMembership.endDate;
            newValues.endDate = input.endDate;
            membershipUpdates.endDate = endDate;
          }

          if (Object.keys(membershipUpdates).length > 0) {
            yield* db.updateMembership(userId, activeMembership.id, membershipUpdates);

            // Update card to match membership
            const updatedUser = yield* db.getUser(userId);
            const updatedMembership = yield* db.getMembership(userId, activeMembership.id);
            if (updatedUser && updatedMembership) {
              yield* cardService.updateCard({
                userId,
                user: updatedUser,
                membership: updatedMembership,
              });
            }
          }
        }

        // Log audit entry
        yield* db.logAuditEntry(userId, 'MEMBER_UPDATED', {
          performedBy: adminUid,
          performedByEmail: adminEmail,
          previousValues,
          newValues,
          reason: input.reason,
          timestamp: new Date().toISOString(),
        });

        return {emailSyncedToStripe, emailSyncedToAuth};
      }),

    // Delete member (soft delete)
    deleteMember: (userId, input, adminUid, adminEmail) =>
      Effect.gen(function* () {
        // Get existing user
        const existingUser = yield* db.getUser(userId);
        if (!existingUser) {
          return yield* new MemberNotFoundError({
            userId,
            message: 'Member not found',
          });
        }

        let stripeSubscriptionCanceled = false;

        // Cancel Stripe subscription if requested
        if (input.cancelStripeSubscription && existingUser.stripeCustomerId) {
          const subscriptions = yield* stripe.listCustomerSubscriptions(
            existingUser.stripeCustomerId,
          );
          const activeSubscription = subscriptions.find(
            (sub) => sub.status === 'active' || sub.status === 'past_due',
          );

          if (activeSubscription) {
            yield* stripe.cancelSubscription(activeSubscription.id, input.reason);
            stripeSubscriptionCanceled = true;
          }
        }

        // Soft delete - sets membership and card status to 'deleted'
        yield* db.softDeleteMember(userId, adminUid, input.reason);

        // Update stats
        const activeMembership = yield* db.getActiveMembership(userId);
        if (activeMembership) {
          yield* stats.decrementStat('activeMembers');
          yield* stats.decrementStat('totalMembers');
          if (activeMembership.planType === 'individual') {
            yield* stats.decrementStat('individualCount');
          } else {
            yield* stats.decrementStat('familyCount');
          }
        }

        // Log audit entry (already logged in softDeleteMember, but add admin details)
        yield* db.logAuditEntry(userId, 'MEMBER_DELETED', {
          performedBy: adminUid,
          performedByEmail: adminEmail,
          reason: input.reason,
          stripeSubscriptionCanceled,
          timestamp: new Date().toISOString(),
        });

        return {stripeSubscriptionCanceled};
      }),

    // Bulk import members
    bulkImportMembers: (rows, adminUid, adminEmail) =>
      Effect.gen(function* () {
        const results: BulkImportResult = {created: 0, errors: []};

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];

          // Validate row
          if (!row.email || !row.planType || !row.startDate || !row.endDate) {
            results.errors.push({
              row: i + 1,
              email: row.email,
              error: 'Missing required fields',
            });
            continue;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(row.email)) {
            results.errors.push({
              row: i + 1,
              email: row.email,
              error: 'Invalid email format',
            });
            continue;
          }

          const startDate = new Date(row.startDate);
          const endDate = new Date(row.endDate);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            results.errors.push({
              row: i + 1,
              email: row.email,
              error: 'Invalid date format',
            });
            continue;
          }

          // Check for existing user
          const existingUser = yield* db.getUserByEmail(row.email);
          if (existingUser) {
            results.errors.push({
              row: i + 1,
              email: row.email,
              error: 'Email already exists',
            });
            continue;
          }

          // Create the member — wrap effectful operations to catch failures
          const createResult = yield* Effect.either(
            Effect.gen(function* () {
              const existingAuthUser = yield* auth.getUserByEmail(row.email);
              let userId: string;

              if (existingAuthUser) {
                userId = existingAuthUser.uid;
              } else {
                const newAuthUser = yield* auth.createAuthUser(row.email, row.name);
                userId = newAuthUser.uid;
              }

              yield* db.createUser(userId, {
                email: row.email,
                name: row.name,
                phone: row.phone,
              });

              const membershipId = `import_${Date.now()}_${i}`;

              yield* db.setMembership(userId, membershipId, {
                stripeSubscriptionId: membershipId,
                planType: row.planType,
                status: 'active',
                startDate,
                endDate,
                autoRenew: false,
                createdAt: null as unknown,
                updatedAt: null as unknown,
              });

              const user = yield* db.getUser(userId);
              const membership = yield* db.getMembership(userId, membershipId);

              if (user && membership) {
                yield* cardService.createCard({userId, user, membership});
              }

              // Update stats
              yield* stats.incrementStat('totalMembers');
              yield* stats.incrementStat('activeMembers');
              if (row.planType === 'individual') {
                yield* stats.incrementStat('individualCount');
              } else {
                yield* stats.incrementStat('familyCount');
              }
            }),
          );

          if (createResult._tag === 'Right') {
            results.created++;
          } else {
            results.errors.push({
              row: i + 1,
              email: row.email,
              error: 'Failed to create member',
            });
          }
        }

        // Log bulk import audit entry
        yield* db.logAuditEntry('system', 'BULK_IMPORT', {
          performedBy: adminUid,
          performedByEmail: adminEmail,
          totalRows: rows.length,
          created: results.created,
          errors: results.errors.length,
          timestamp: new Date().toISOString(),
        });

        return results;
      }),

    // Get expiring memberships
    getExpiringMemberships: (withinDays) =>
      Effect.gen(function* () {
        const members = yield* db.getExpiringMemberships(withinDays);
        const now = new Date();

        return members
          .filter((m) => m.user && m.membership)
          .map((m) => {
            // Dates are ISO strings from Postgres
            // Safe: .filter above ensures both user and membership exist
            const membership = m.membership as NonNullable<typeof m.membership>;
            const user = m.user as NonNullable<typeof m.user>;
            const expirationDate = new Date(membership.endDate as string);

            const daysUntilExpiration = Math.ceil(
              (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );

            return {
              userId: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              planType: membership.planType,
              status: membership.status,
              membershipNumber: m.card?.membershipNumber,
              expirationDate: expirationDate.toISOString(),
              daysUntilExpiration,
            };
          });
      }),

    // Get member audit log
    getMemberAuditLog: (userId) =>
      Effect.gen(function* () {
        const user = yield* db.getUser(userId);
        if (!user) {
          return yield* new MemberNotFoundError({
            userId,
            message: 'Member not found',
          });
        }

        const entries = yield* db.getMemberAuditLog(userId);

        return entries.map((entry) => ({
          id: entry.id,
          action: entry.action as AuditEntry['action'],
          performedBy: (entry.details?.performedBy as string) || 'system',
          performedByEmail: entry.details?.performedByEmail as string | undefined,
          details: entry.details || {},
          timestamp:
            typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString(),
        }));
      }),

    // Get payment history
    getPaymentHistory: (userId) =>
      Effect.gen(function* () {
        const user = yield* db.getUser(userId);
        if (!user) {
          return yield* new MemberNotFoundError({
            userId,
            message: 'Member not found',
          });
        }

        if (!user.stripeCustomerId) {
          return [];
        }

        const invoices = yield* stripe.getPaymentHistory(user.stripeCustomerId);

        return invoices.map((invoice) => {
          // payment_intent is expanded via the API call, access via type assertion
          const invoiceWithExpanded = invoice as Stripe.Invoice & {
            payment_intent?: string | Stripe.PaymentIntent | null;
          };
          const paymentIntent =
            typeof invoiceWithExpanded.payment_intent === 'object'
              ? invoiceWithExpanded.payment_intent
              : null;

          return {
            id: invoice.id,
            date: new Date(invoice.created * 1000).toISOString(),
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status === 'paid' ? 'paid' : ('pending' as const),
            description: invoice.description || `Invoice ${invoice.number}`,
            invoiceUrl: invoice.hosted_invoice_url || undefined,
            paymentIntentId: paymentIntent?.id,
            refundable: invoice.status === 'paid' && !!paymentIntent?.id,
          };
        });
      }),

    // Issue refund
    issueRefund: (userId, paymentIntentId, adminUid, amount, reason) =>
      Effect.gen(function* () {
        const user = yield* db.getUser(userId);
        if (!user) {
          return yield* new MemberNotFoundError({
            userId,
            message: 'Member not found',
          });
        }

        const refund = yield* stripe.createRefund(paymentIntentId, amount, reason);

        // Log audit entry
        yield* db.logAuditEntry(userId, 'REFUND_ISSUED', {
          performedBy: adminUid,
          refundId: refund.id,
          paymentIntentId,
          amount: refund.amount,
          reason,
          timestamp: new Date().toISOString(),
        });

        return refund;
      }),
  });
});

// Live layer
export const AdminServiceLive = Layer.effect(AdminService, make);

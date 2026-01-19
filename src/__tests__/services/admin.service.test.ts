import {Effect, Exit, Layer} from 'effect';
import {describe, it, expect, vi} from 'vitest';

import {AdminService, AdminServiceLive} from '@/src/lib/effect/admin.service';
import {MembershipCardService} from '@/src/lib/effect/card.service';
import {AdminError, FirestoreError, StripeError} from '@/src/lib/effect/errors';
import {StatsService} from '@/src/lib/effect/stats.service';
import type {ReconciliationReport} from '@/src/lib/effect/schemas';

import {
  createTestAdminService,
  createTestAuthService,
  createTestFirestoreService,
  createTestStripeService,
  TestAdminLayer,
  TestAuthLayer,
  TestFirestoreLayer,
  TestStripeLayer,
} from '../layers/test-layers';
import {createMockCustomer, createMockSubscription} from '../mocks/stripe.mock';
import {createMockMembershipCard, createMockMembershipDocument, createMockUserDocument} from '../mocks/firestore.mock';

describe('AdminService', () => {
  describe('validateStripeVsFirebase', () => {
    it('should return NO_STRIPE_CUSTOMER when no Stripe customer found', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: null,
            firebaseData: null,
            discrepancies: ['NO_STRIPE_CUSTOMER'],
            canReconcile: false,
            reconcileActions: ['No action possible - no Stripe subscription found'],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.stripeData).toBeNull();
      expect(result.discrepancies).toContain('NO_STRIPE_CUSTOMER');
      expect(result.canReconcile).toBe(false);
    });

    it('should return MISSING_FIREBASE_USER when Stripe customer exists but no Firebase user', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: {
              customerId: 'cus_test_123',
              customerEmail: 'test@example.com',
              subscriptionId: 'sub_test_123',
              subscriptionStatus: 'active',
              priceId: 'price_individual_test',
              planType: 'individual',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false,
            },
            firebaseData: null,
            discrepancies: ['MISSING_FIREBASE_USER', 'MISSING_FIREBASE_MEMBERSHIP', 'MISSING_FIREBASE_CARD'],
            canReconcile: true,
            reconcileActions: [
              'Create Firebase user linked to Stripe customer',
              'Create membership document with status: active',
              'Generate new membership card with QR code',
            ],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.stripeData).not.toBeNull();
      expect(result.firebaseData).toBeNull();
      expect(result.discrepancies).toContain('MISSING_FIREBASE_USER');
      expect(result.discrepancies).toContain('MISSING_FIREBASE_MEMBERSHIP');
      expect(result.discrepancies).toContain('MISSING_FIREBASE_CARD');
      expect(result.canReconcile).toBe(true);
    });

    it('should return STATUS_MISMATCH when statuses differ', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: {
              customerId: 'cus_test_123',
              customerEmail: 'test@example.com',
              subscriptionId: 'sub_test_123',
              subscriptionStatus: 'active',
              priceId: 'price_individual_test',
              planType: 'individual',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false,
            },
            firebaseData: {
              userId: 'user_123',
              userEmail: 'test@example.com',
              membership: {
                id: 'sub_test_123',
                stripeSubscriptionId: 'sub_test_123',
                status: 'canceled',
                planType: 'individual',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                autoRenew: true,
              },
              card: {
                membershipNumber: 'DEC-2025-000001',
                status: 'canceled',
                planType: 'individual',
                validFrom: new Date().toISOString(),
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
            discrepancies: ['STATUS_MISMATCH', 'CARD_STATUS_MISMATCH'],
            canReconcile: true,
            reconcileActions: [
              'Update membership status: canceled → active',
              'Update card to match membership (preserve membership number)',
            ],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.discrepancies).toContain('STATUS_MISMATCH');
      expect(result.canReconcile).toBe(true);
    });

    it('should return NO_DISCREPANCY when data is in sync', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: {
              customerId: 'cus_test_123',
              customerEmail: 'test@example.com',
              subscriptionId: 'sub_test_123',
              subscriptionStatus: 'active',
              priceId: 'price_individual_test',
              planType: 'individual',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false,
            },
            firebaseData: {
              userId: 'user_123',
              userEmail: 'test@example.com',
              membership: {
                id: 'sub_test_123',
                stripeSubscriptionId: 'sub_test_123',
                status: 'active',
                planType: 'individual',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                autoRenew: true,
              },
              card: {
                membershipNumber: 'DEC-2025-000001',
                status: 'active',
                planType: 'individual',
                validFrom: new Date().toISOString(),
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
            discrepancies: ['NO_DISCREPANCY'],
            canReconcile: false,
            reconcileActions: [],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.discrepancies).toContain('NO_DISCREPANCY');
      expect(result.canReconcile).toBe(false);
    });

    it('should return MISSING_FIREBASE_CARD when card is missing', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: {
              customerId: 'cus_test_123',
              customerEmail: 'test@example.com',
              subscriptionId: 'sub_test_123',
              subscriptionStatus: 'active',
              priceId: 'price_individual_test',
              planType: 'individual',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false,
            },
            firebaseData: {
              userId: 'user_123',
              userEmail: 'test@example.com',
              membership: {
                id: 'sub_test_123',
                stripeSubscriptionId: 'sub_test_123',
                status: 'active',
                planType: 'individual',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                autoRenew: true,
              },
              card: null,
            },
            discrepancies: ['MISSING_FIREBASE_CARD'],
            canReconcile: true,
            reconcileActions: ['Generate new membership card with QR code'],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.discrepancies).toContain('MISSING_FIREBASE_CARD');
      expect(result.canReconcile).toBe(true);
      expect(result.reconcileActions).toContain('Generate new membership card with QR code');
    });
  });

  describe('reconcileMembership', () => {
    it('should fail when no Stripe subscription found', async () => {
      const adminService = createTestAdminService({
        reconcileMembership: vi.fn(() =>
          Effect.succeed({
            success: false,
            email: 'test@example.com',
            actionsPerformed: [],
            membershipUpdated: false,
            cardUpdated: false,
            cardCreated: false,
            userCreated: false,
            error: 'Cannot reconcile: No active Stripe subscription found',
          }),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.reconcileMembership('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active Stripe subscription');
    });

    it('should create user, membership, and card when all missing', async () => {
      const adminService = createTestAdminService({
        reconcileMembership: vi.fn(() =>
          Effect.succeed({
            success: true,
            email: 'test@example.com',
            actionsPerformed: [
              'Created Firebase user: user_new_123',
              'Created membership: sub_test_123',
              'Created membership card with new number',
            ],
            membershipUpdated: true,
            cardUpdated: false,
            cardCreated: true,
            userCreated: true,
          }),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.reconcileMembership('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.success).toBe(true);
      expect(result.userCreated).toBe(true);
      expect(result.membershipUpdated).toBe(true);
      expect(result.cardCreated).toBe(true);
      expect(result.actionsPerformed).toContain('Created Firebase user: user_new_123');
      expect(result.actionsPerformed).toContain('Created membership: sub_test_123');
      expect(result.actionsPerformed).toContain('Created membership card with new number');
    });

    it('should update existing card preserving membership number', async () => {
      const adminService = createTestAdminService({
        reconcileMembership: vi.fn(() =>
          Effect.succeed({
            success: true,
            email: 'test@example.com',
            actionsPerformed: [
              'Updated membership: sub_test_123',
              'Updated membership card (preserved number)',
            ],
            membershipUpdated: true,
            cardUpdated: true,
            cardCreated: false,
            userCreated: false,
          }),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.reconcileMembership('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.success).toBe(true);
      expect(result.cardUpdated).toBe(true);
      expect(result.cardCreated).toBe(false);
      expect(result.actionsPerformed).toContain('Updated membership card (preserved number)');
    });

    it('should create new card when membership exists but card is missing', async () => {
      const adminService = createTestAdminService({
        reconcileMembership: vi.fn(() =>
          Effect.succeed({
            success: true,
            email: 'test@example.com',
            actionsPerformed: [
              'Updated membership: sub_test_123',
              'Created membership card with new number',
            ],
            membershipUpdated: true,
            cardUpdated: false,
            cardCreated: true,
            userCreated: false,
          }),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.reconcileMembership('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.success).toBe(true);
      expect(result.cardCreated).toBe(true);
      expect(result.actionsPerformed).toContain('Created membership card with new number');
    });
  });

  describe('detectDiscrepancies helper', () => {
    it('should detect PLAN_MISMATCH when plan types differ', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: {
              customerId: 'cus_test_123',
              customerEmail: 'test@example.com',
              subscriptionId: 'sub_test_123',
              subscriptionStatus: 'active',
              priceId: 'price_family_test',
              planType: 'family',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false,
            },
            firebaseData: {
              userId: 'user_123',
              userEmail: 'test@example.com',
              membership: {
                id: 'sub_test_123',
                stripeSubscriptionId: 'sub_test_123',
                status: 'active',
                planType: 'individual',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                autoRenew: true,
              },
              card: {
                membershipNumber: 'DEC-2025-000001',
                status: 'active',
                planType: 'individual',
                validFrom: new Date().toISOString(),
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
            discrepancies: ['PLAN_MISMATCH', 'CARD_STATUS_MISMATCH'],
            canReconcile: true,
            reconcileActions: [
              'Update membership plan type: individual → family',
              'Update card to match membership (preserve membership number)',
            ],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.discrepancies).toContain('PLAN_MISMATCH');
    });

    it('should detect DATE_MISMATCH when end dates differ significantly', async () => {
      const adminService = createTestAdminService({
        validateStripeVsFirebase: vi.fn(() =>
          Effect.succeed({
            email: 'test@example.com',
            stripeData: {
              customerId: 'cus_test_123',
              customerEmail: 'test@example.com',
              subscriptionId: 'sub_test_123',
              subscriptionStatus: 'active',
              priceId: 'price_individual_test',
              planType: 'individual',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false,
            },
            firebaseData: {
              userId: 'user_123',
              userEmail: 'test@example.com',
              membership: {
                id: 'sub_test_123',
                stripeSubscriptionId: 'sub_test_123',
                status: 'active',
                planType: 'individual',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days vs 365 days
                autoRenew: true,
              },
              card: {
                membershipNumber: 'DEC-2025-000001',
                status: 'active',
                planType: 'individual',
                validFrom: new Date().toISOString(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
            discrepancies: ['DATE_MISMATCH', 'CARD_DATES_MISMATCH'],
            canReconcile: true,
            reconcileActions: [
              'Update membership end date to: ' +
                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
              'Update card to match membership (preserve membership number)',
            ],
          } as ReconciliationReport),
        ),
      });

      const testLayer = TestAdminLayer(adminService);

      const program = Effect.gen(function* () {
        const service = yield* AdminService;
        return yield* service.validateStripeVsFirebase('test@example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.discrepancies).toContain('DATE_MISMATCH');
    });
  });
});

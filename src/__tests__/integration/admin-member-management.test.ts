import {Effect, Layer} from 'effect';
import {describe, expect, it, vi} from 'vitest';

import {AdminService, AdminServiceLive} from '@/src/lib/effect/admin.service';
import {MembershipCardService} from '@/src/lib/effect/card.service';
import {StatsService} from '@/src/lib/effect/stats.service';
import type {CreateMemberInput, UpdateMemberInput, DeleteMemberInput} from '@/src/types/admin';

import {
  createTestAuthService,
  createTestFirestoreService,
  createTestStripeService,
  TestAuthLayer,
  TestFirestoreLayer,
  TestStripeLayer,
} from '../layers/test-layers';

describe('Admin Member Management Integration', () => {
  describe('Full Member Lifecycle', () => {
    it('should create, update, and delete a member', async () => {
      const userId = 'test_user_123';
      const membershipNumber = 'DEC-2026-000001';

      // Create member
      const authService = createTestAuthService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        createAuthUser: vi.fn((email) => Effect.succeed({uid: userId, email})),
        updateUserEmail: vi.fn(() => Effect.void),
      });

      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        getUser: vi.fn((uid) => {
          if (uid === userId) {
            return Effect.succeed({
              id: userId,
              email: 'test@example.com',
              name: 'Test User',
              phone: '207-555-1234',
              stripeCustomerId: 'cus_123',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Effect.succeed(null);
        }),
        createUser: vi.fn(() =>
          Effect.succeed({
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        updateUser: vi.fn(() => Effect.void),
        getNextMembershipNumber: vi.fn(() => Effect.succeed(membershipNumber)),
        setMembership: vi.fn(() => Effect.void),
        getMembership: vi.fn((uid, membershipId) =>
          Effect.succeed({
            id: membershipId || 'mem_123',
            userId: uid,
            stripeSubscriptionId: 'sub_123',
            status: 'active' as const,
            planType: 'individual' as const,
            startDate: null,
            endDate: null,
            autoRenew: false,
            createdAt: null,
            updatedAt: null,
          }),
        ),
        getActiveMembership: vi.fn(() =>
          Effect.succeed({
            id: 'mem_123',
            userId,
            stripeSubscriptionId: 'sub_123',
            status: 'active' as const,
            planType: 'individual' as const,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            autoRenew: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        updateMembership: vi.fn(() => Effect.void),
        softDeleteMember: vi.fn(() => Effect.void),
        getStats: vi.fn(() =>
          Effect.succeed({
            totalMembers: 10,
            updatedAt: new Date().toISOString(),
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
        updateStats: vi.fn(() => Effect.void),
        logAuditEntry: vi.fn(() => Effect.void),
        getMemberAuditLog: vi.fn((_uid) =>
          Effect.succeed([
            {
              id: 'audit_1',
              action: 'MEMBER_CREATED',
              performedBy: 'admin_123',
              performedByEmail: 'admin@example.com',
              timestamp: new Date().toISOString(),
              details: {
                newValues: {
                  email: 'test@example.com',
                  planType: 'individual',
                },
              },
            },
            {
              id: 'audit_2',
              action: 'MEMBER_UPDATED',
              performedBy: 'admin_123',
              performedByEmail: 'admin@example.com',
              timestamp: new Date().toISOString(),
              details: {
                previousValues: {email: 'test@example.com'},
                newValues: {email: 'newemail@example.com'},
                reason: 'Email change',
              },
            },
            {
              id: 'audit_3',
              action: 'MEMBER_DELETED',
              performedBy: 'admin_123',
              performedByEmail: 'admin@example.com',
              timestamp: new Date().toISOString(),
              details: {
                reason: 'User requested deletion',
              },
            },
          ]),
        ),
      });

      const stripeService = createTestStripeService({
        updateCustomerEmail: vi.fn(() =>
          Effect.succeed({id: 'cus_123', email: 'newemail@example.com'} as any),
        ),
        listCustomerSubscriptions: vi.fn(() =>
          Effect.succeed([
            {
              id: 'sub_123',
              status: 'active' as const,
              customer: 'cus_123',
              created: Date.now(),
              current_period_end: Date.now() + 86400000,
              current_period_start: Date.now(),
            } as any,
          ]),
        ),
        cancelSubscription: vi.fn(() => Effect.succeed({id: 'sub_123', status: 'canceled'} as any)),
      });

      const cardService = {
        createCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId,
            membershipNumber,
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        updateCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId,
            membershipNumber,
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber,
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
        verifyQRCode: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber,
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
      };

      const statsService = {
        getStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 10,
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
        incrementStat: vi.fn(() => Effect.void),
        decrementStat: vi.fn(() => Effect.void),
        refreshStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 10,
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestFirestoreLayer(firestoreService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      // Step 1: Create member
      const createInput: CreateMemberInput = {
        email: 'test@example.com',
        name: 'Test User',
        phone: '207-555-1234',
        planType: 'individual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'active',
      };

      const createProgram = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.createMember(createInput, 'admin_123', 'admin@example.com');
      });

      const createResult = await Effect.runPromise(
        Effect.provide(Effect.provide(createProgram, AdminServiceLive), testLayer),
      );

      expect(createResult.userId).toBe(userId);
      expect(createResult.membershipNumber).toBe(membershipNumber);
      expect(firestoreService.logAuditEntry).toHaveBeenCalledWith(
        userId,
        'MEMBER_CREATED',
        expect.any(Object),
      );

      // Step 2: Update member
      const updateInput: UpdateMemberInput = {
        email: 'newemail@example.com',
        reason: 'Email change requested',
      };

      const updateProgram = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.updateMember(userId, updateInput, 'admin_123', 'admin@example.com');
      });

      const updateResult = await Effect.runPromise(
        Effect.provide(Effect.provide(updateProgram, AdminServiceLive), testLayer),
      );

      expect(updateResult.emailSyncedToStripe).toBe(true);
      expect(updateResult.emailSyncedToAuth).toBe(true);
      expect(stripeService.updateCustomerEmail).toHaveBeenCalled();
      expect(authService.updateUserEmail).toHaveBeenCalled();

      // Step 3: View audit log
      const auditProgram = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.getMemberAuditLog(userId);
      });

      const auditLog = await Effect.runPromise(
        Effect.provide(Effect.provide(auditProgram, AdminServiceLive), testLayer),
      );

      expect(auditLog).toHaveLength(3);
      expect(auditLog[0].action).toBe('MEMBER_CREATED');
      expect(auditLog[1].action).toBe('MEMBER_UPDATED');
      expect(auditLog[2].action).toBe('MEMBER_DELETED');

      // Step 4: Delete member
      const deleteInput: DeleteMemberInput = {
        reason: 'User requested deletion',
        cancelStripeSubscription: true,
      };

      const deleteProgram = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.deleteMember(userId, deleteInput, 'admin_123', 'admin@example.com');
      });

      const deleteResult = await Effect.runPromise(
        Effect.provide(Effect.provide(deleteProgram, AdminServiceLive), testLayer),
      );

      expect(deleteResult.stripeSubscriptionCanceled).toBe(true);
      expect(stripeService.cancelSubscription).toHaveBeenCalledWith('sub_123', deleteInput.reason);
      expect(firestoreService.softDeleteMember).toHaveBeenCalled();
    });
  });

  describe('Bulk Import Flow', () => {
    it('should import multiple legacy members', async () => {
      const authService = createTestAuthService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        createAuthUser: vi.fn((email) =>
          Effect.succeed({uid: `user_${email.split('@')[0]}`, email}),
        ),
      });

      let membershipNumberCounter = 1;
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        createUser: vi.fn((userId, data) =>
          Effect.succeed({
            id: userId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getUser: vi.fn((userId) =>
          Effect.succeed({
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getMembership: vi.fn((userId, membershipId) =>
          Effect.succeed({
            id: membershipId,
            userId,
            stripeSubscriptionId: membershipId,
            planType: 'individual' as const,
            status: 'active' as const,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            autoRenew: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getNextMembershipNumber: vi.fn(() => {
          const num = `DEC-2026-${String(membershipNumberCounter).padStart(6, '0')}`;
          membershipNumberCounter++;
          return Effect.succeed(num);
        }),
        setMembership: vi.fn(() => Effect.void),
        getStats: vi.fn(() =>
          Effect.succeed({
            totalMembers: 10,
            updatedAt: new Date().toISOString(),
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
        updateStats: vi.fn(() => Effect.void),
        logAuditEntry: vi.fn(() => Effect.void),
      });

      const cardService = {
        createCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId: 'test_user',
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        updateCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId: 'test_user',
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
        verifyQRCode: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
      };

      const statsService = {
        getStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 15,
            activeMembers: 13,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 8,
            familyCount: 5,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
        incrementStat: vi.fn(() => Effect.void),
        decrementStat: vi.fn(() => Effect.void),
        refreshStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 15,
            activeMembers: 13,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 8,
            familyCount: 5,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const stripeService = createTestStripeService({});

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestFirestoreLayer(firestoreService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const rows = [
        {
          email: 'legacy1@example.com',
          name: 'Legacy Member 1',
          planType: 'individual' as const,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        },
        {
          email: 'legacy2@example.com',
          name: 'Legacy Member 2',
          planType: 'family' as const,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        },
        {
          email: 'legacy3@example.com',
          name: 'Legacy Member 3',
          planType: 'individual' as const,
          startDate: '2025-06-01',
          endDate: '2026-05-31',
        },
      ];

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.bulkImportMembers(rows, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.created).toBe(3);
      expect(result.errors).toEqual([]);
      expect(authService.createAuthUser).toHaveBeenCalledTimes(3);
      expect(firestoreService.createUser).toHaveBeenCalledTimes(3);
      expect(firestoreService.setMembership).toHaveBeenCalledTimes(3);
      expect(cardService.createCard).toHaveBeenCalledTimes(3);
    });
  });

  describe('Expiring Members Report', () => {
    it('should retrieve members expiring within 30 days', async () => {
      const now = new Date();
      const in29Days = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);

      const firestoreService = createTestFirestoreService({
        getExpiringMemberships: vi.fn((_withinDays) =>
          Effect.succeed([
            {
              user: {
                id: 'user_1',
                email: 'expiring1@example.com',
                name: 'Expiring Member 1',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              membership: {
                id: 'mem_1',
                userId: 'user_1',
                membershipNumber: 'DEC-2025-000001',
                stripeSubscriptionId: 'sub_legacy',
                planType: 'individual' as const,
                status: 'active' as const,
                startDate: '2025-01-01',
                endDate: in29Days.toISOString().split('T')[0],
                autoRenew: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              card: null,
            },
            {
              user: {
                id: 'user_2',
                email: 'expiring2@example.com',
                name: 'Expiring Member 2',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              membership: {
                id: 'mem_2',
                userId: 'user_2',
                membershipNumber: 'DEC-2025-000002',
                stripeSubscriptionId: 'sub_legacy',
                planType: 'family' as const,
                status: 'active' as const,
                startDate: '2025-01-01',
                endDate: in29Days.toISOString().split('T')[0],
                autoRenew: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              card: null,
            },
          ]),
        ),
      });

      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const cardService = {
        createCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId: 'test_user',
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        updateCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId: 'test_user',
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
        verifyQRCode: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
      };
      const statsService = {
        getStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 10,
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
        incrementStat: vi.fn(() => Effect.void),
        decrementStat: vi.fn(() => Effect.void),
        refreshStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 10,
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const testLayer = Layer.mergeAll(
        TestFirestoreLayer(firestoreService),
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.getExpiringMemberships(30);
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result).toHaveLength(2);
      expect(result[0].daysUntilExpiration).toBe(29);
      expect(result[1].daysUntilExpiration).toBe(29);
      expect(firestoreService.getExpiringMemberships).toHaveBeenCalledWith(30);
    });
  });

  describe('Payment History and Refunds', () => {
    it('should retrieve payment history and issue refund', async () => {
      const userId = 'user_123';

      const firestoreService = createTestFirestoreService({
        getUser: vi.fn(() =>
          Effect.succeed({
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            stripeCustomerId: 'cus_123',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        logAuditEntry: vi.fn(() => Effect.void),
      });

      const stripeService = createTestStripeService({
        getPaymentHistory: vi.fn(() =>
          Effect.succeed([
            {
              id: 'in_123',
              created: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
              amount_paid: 5000,
              currency: 'usd',
              status: 'paid',
              description: 'Individual Membership',
              hosted_invoice_url: 'https://stripe.com/invoice/123',
              payment_intent: {
                id: 'pi_123',
                status: 'succeeded',
              },
            } as any,
          ]),
        ),
        createRefund: vi.fn(() =>
          Effect.succeed({
            id: 'ref_123',
            amount: 5000,
            status: 'succeeded',
          } as any),
        ),
      });

      const authService = createTestAuthService();
      const cardService = {
        createCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId: 'test_user',
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        updateCard: vi.fn(() =>
          Effect.succeed({
            id: 'card_123',
            userId: 'test_user',
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            email: 'test@example.com',
            planType: 'individual' as const,
            status: 'active' as const,
            validFrom: '2026-01-01',
            validUntil: '2026-12-31',
            qrCodeData: 'qr_data',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
        verifyQRCode: vi.fn(() =>
          Effect.succeed({
            valid: true,
            membershipNumber: 'DEC-2026-000001',
            memberName: 'Test User',
            planType: 'individual' as const,
            status: 'active' as const,
            expiresAt: '2026-12-31',
            daysRemaining: 365,
            message: '',
          }),
        ),
      };
      const statsService = {
        getStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 10,
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
        incrementStat: vi.fn(() => Effect.void),
        decrementStat: vi.fn(() => Effect.void),
        refreshStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 10,
            activeMembers: 8,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 5,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const testLayer = Layer.mergeAll(
        TestFirestoreLayer(firestoreService),
        TestStripeLayer(stripeService),
        TestAuthLayer(authService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      // Get payment history
      const historyProgram = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.getPaymentHistory(userId);
      });

      const history = await Effect.runPromise(
        Effect.provide(Effect.provide(historyProgram, AdminServiceLive), testLayer),
      );

      expect(history).toHaveLength(1);
      expect(history[0].amount).toBe(5000);
      expect(history[0].status).toBe('paid');
      expect(history[0].refundable).toBe(true);

      // Issue refund
      const refundProgram = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.issueRefund(userId, 'pi_123', 'admin_123');
      });

      const refund = await Effect.runPromise(
        Effect.provide(Effect.provide(refundProgram, AdminServiceLive), testLayer),
      );

      expect(refund.id).toBe('ref_123');
      expect(refund.amount).toBe(5000);
      expect(stripeService.createRefund).toHaveBeenCalledWith('pi_123', undefined, undefined);
      expect(firestoreService.logAuditEntry).toHaveBeenCalledWith(
        userId,
        'REFUND_ISSUED',
        expect.objectContaining({
          performedBy: 'admin_123',
        }),
      );
    });
  });
});

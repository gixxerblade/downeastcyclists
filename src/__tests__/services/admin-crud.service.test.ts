import {Effect, Exit, Layer} from 'effect';
import {describe, expect, it, vi} from 'vitest';

import {AdminService, AdminServiceLive} from '@/src/lib/effect/admin.service';
import {MembershipCardService} from '@/src/lib/effect/card.service';
import {StatsService} from '@/src/lib/effect/stats.service';
import type {CreateMemberInput, UpdateMemberInput, DeleteMemberInput} from '@/src/types/admin';

import {
  createTestAuthService,
  createTestDatabaseService,
  createTestStripeService,
  TestAuthLayer,
  TestDatabaseLayer,
  TestStripeLayer,
} from '../layers/test-layers';

describe('AdminService CRUD Operations', () => {
  describe('createMember', () => {
    it('should create a new member with all required fields', async () => {
      const userId = 'new_user_123';
      const _membershipId = 'mem_123';
      const membershipNumber = 'DEC-2026-000001';

      const authService = createTestAuthService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        createAuthUser: vi.fn((email) => Effect.succeed({uid: userId, email})),
      });

      const databaseService = createTestDatabaseService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        createUser: vi.fn(() =>
          Effect.succeed({
            id: userId,
            email: 'new@example.com',
            name: 'New Member',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getUser: vi.fn(() =>
          Effect.succeed({
            id: userId,
            email: 'new@example.com',
            name: 'New Member',
            phone: '207-555-1234',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getMembership: vi.fn(() =>
          Effect.succeed({
            id: expect.any(String),
            userId,
            stripeSubscriptionId: expect.any(String),
            planType: 'individual' as const,
            status: 'active' as const,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            autoRenew: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getNextMembershipNumber: vi.fn(() => Effect.succeed(membershipNumber)),
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
            totalMembers: 11,
            activeMembers: 9,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 6,
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
            totalMembers: 11,
            activeMembers: 9,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 6,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const stripeService = createTestStripeService({});

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: CreateMemberInput = {
        email: 'new@example.com',
        name: 'New Member',
        phone: '207-555-1234',
        planType: 'individual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'active',
        notes: 'Test member',
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.createMember(input, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.userId).toBe(userId);
      expect(result.membershipNumber).toBe(membershipNumber);
      expect(authService.createAuthUser).toHaveBeenCalledWith('new@example.com', 'New Member');
      expect(databaseService.createUser).toHaveBeenCalled();
      expect(databaseService.setMembership).toHaveBeenCalled();
      expect(databaseService.logAuditEntry).toHaveBeenCalledWith(
        userId,
        'MEMBER_CREATED',
        expect.objectContaining({
          performedBy: 'admin_123',
          performedByEmail: 'admin@example.com',
        }),
      );
    });

    it('should fail with EmailConflictError if email already exists', async () => {
      const authService = createTestAuthService({});

      const databaseService = createTestDatabaseService({
        getUserByEmail: vi.fn(() =>
          Effect.succeed({
            id: 'existing_123',
            email: 'existing@example.com',
            name: 'Existing User',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
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

      const stripeService = createTestStripeService({});

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: CreateMemberInput = {
        email: 'existing@example.com',
        planType: 'individual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'active',
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.createMember(input, 'admin_123');
      });

      const exit = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail');
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error._tag).toBe('EmailConflictError');
        }
      }
    });

    it('should fail with ValidationError if dates are invalid', async () => {
      const authService = createTestAuthService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
      });
      const databaseService = createTestDatabaseService();
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

      const stripeService = createTestStripeService({});

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: CreateMemberInput = {
        email: 'test@example.com',
        planType: 'individual',
        startDate: '2026-12-31',
        endDate: '2026-01-01', // End before start
        status: 'active',
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.createMember(input, 'admin_123');
      });

      const exit = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail');
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error._tag).toBe('ValidationError');
        }
      }
    });
  });

  describe('updateMember', () => {
    it('should update member fields and log audit entry', async () => {
      const userId = 'user_123';
      const existingUser = {
        id: userId,
        email: 'old@example.com',
        name: 'Old Name',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(existingUser)),
        updateUser: vi.fn(() => Effect.void),
        getMembership: vi.fn((uid, membershipId) =>
          Effect.succeed({
            id: membershipId || 'mem_123',
            userId: uid,
            stripeSubscriptionId: 'sub_123',
            status: 'active' as const,
            planType: 'individual' as const,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            autoRenew: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        updateMembership: vi.fn(() => Effect.void),
        logAuditEntry: vi.fn(() => Effect.void),
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
        TestDatabaseLayer(databaseService),
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: UpdateMemberInput = {
        name: 'New Name',
        phone: '207-555-9999',
        reason: 'Updated contact info',
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.updateMember(userId, input, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.emailSyncedToStripe).toBe(false);
      expect(result.emailSyncedToAuth).toBe(false);
      expect(databaseService.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          name: 'New Name',
          phone: '207-555-9999',
        }),
      );
      expect(databaseService.logAuditEntry).toHaveBeenCalledWith(
        userId,
        'MEMBER_UPDATED',
        expect.objectContaining({
          performedBy: 'admin_123',
          reason: 'Updated contact info',
          previousValues: expect.any(Object),
          newValues: expect.any(Object),
        }),
      );
    });

    it('should sync email to Stripe and Auth when email changes', async () => {
      const userId = 'user_123';
      const existingUser = {
        id: userId,
        email: 'old@example.com',
        name: 'Test User',
        stripeCustomerId: 'cus_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(existingUser)),
        updateUser: vi.fn(() => Effect.void),
        getMembership: vi.fn((uid, membershipId) =>
          Effect.succeed({
            id: membershipId || 'mem_123',
            userId: uid,
            stripeSubscriptionId: 'sub_123',
            status: 'active' as const,
            planType: 'individual' as const,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            autoRenew: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        updateMembership: vi.fn(() => Effect.void),
        logAuditEntry: vi.fn(() => Effect.void),
      });

      const stripeService = createTestStripeService({
        updateCustomerEmail: vi.fn(() =>
          Effect.succeed({id: 'cus_123', email: 'new@example.com'} as any),
        ),
      });

      const authService = createTestAuthService({
        updateUserEmail: vi.fn(() => Effect.void),
      });

      const cardService = {
        createCard: vi.fn(() => Effect.succeed({} as any)),
        updateCard: vi.fn(() => Effect.succeed({} as any)),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() => Effect.succeed({} as any)),
        verifyQRCode: vi.fn(() => Effect.succeed({} as any)),
      };

      const statsService = {
        getStats: vi.fn(() => Effect.succeed({} as any)),
        incrementStat: vi.fn(() => Effect.void),
        decrementStat: vi.fn(() => Effect.void),
        refreshStats: vi.fn(() => Effect.succeed({} as any)),
      };

      const testLayer = Layer.mergeAll(
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        TestAuthLayer(authService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: UpdateMemberInput = {
        email: 'new@example.com',
        reason: 'Email change requested',
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.updateMember(userId, input, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.emailSyncedToStripe).toBe(true);
      expect(result.emailSyncedToAuth).toBe(true);
      expect(stripeService.updateCustomerEmail).toHaveBeenCalledWith('cus_123', 'new@example.com');
      expect(authService.updateUserEmail).toHaveBeenCalledWith(userId, 'new@example.com');
    });

    it('should fail with MemberNotFoundError if user does not exist', async () => {
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(null)),
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
        getStats: vi.fn(() => Effect.succeed({} as any)),
        incrementStat: vi.fn(() => Effect.void),
        decrementStat: vi.fn(() => Effect.void),
        refreshStats: vi.fn(() => Effect.succeed({} as any)),
      };

      const testLayer = Layer.mergeAll(
        TestDatabaseLayer(databaseService),
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: UpdateMemberInput = {
        name: 'New Name',
        reason: 'Update',
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.updateMember('nonexistent_123', input, 'admin_123');
      });

      const exit = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail');
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error._tag).toBe('MemberNotFoundError');
        }
      }
    });
  });

  describe('deleteMember', () => {
    it('should soft delete member and cancel Stripe subscription', async () => {
      const userId = 'user_123';
      const existingUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: 'cus_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(existingUser)),
        getMembership: vi.fn((uid, membershipId) =>
          Effect.succeed({
            id: membershipId || 'mem_123',
            userId: uid,
            stripeSubscriptionId: 'sub_123',
            status: 'active' as const,
            planType: 'individual' as const,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            autoRenew: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        getActiveMembership: vi.fn(() =>
          Effect.succeed({
            id: 'mem_123',
            userId,
            stripeSubscriptionId: 'sub_123',
            status: 'active' as const,
            planType: 'individual' as const,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            autoRenew: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
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
      });

      const stripeService = createTestStripeService({
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

      const statsService = {
        getStats: vi.fn(() =>
          Effect.succeed({
            updatedAt: new Date().toISOString(),
            totalMembers: 9,
            activeMembers: 7,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 4,
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
            totalMembers: 9,
            activeMembers: 7,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 4,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const authService = createTestAuthService({});
      const cardService = {
        createCard: vi.fn(() => Effect.succeed({} as any)),
        updateCard: vi.fn(() => Effect.succeed({} as any)),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() => Effect.succeed({} as any)),
        verifyQRCode: vi.fn(() => Effect.succeed({} as any)),
      };

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: DeleteMemberInput = {
        reason: 'User requested deletion',
        cancelStripeSubscription: true,
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.deleteMember(userId, input, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.stripeSubscriptionCanceled).toBe(true);
      expect(stripeService.cancelSubscription).toHaveBeenCalledWith('sub_123', input.reason);
      expect(databaseService.softDeleteMember).toHaveBeenCalledWith(
        userId,
        'admin_123',
        input.reason,
      );
      expect(databaseService.logAuditEntry).toHaveBeenCalledWith(
        userId,
        'MEMBER_DELETED',
        expect.objectContaining({
          performedBy: 'admin_123',
          reason: input.reason,
        }),
      );
    });

    it('should fail with MemberNotFoundError if user does not exist', async () => {
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(null)),
      });

      const stripeService = createTestStripeService();
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

      const authService = createTestAuthService({});
      const cardService = {
        createCard: vi.fn(() => Effect.succeed({} as any)),
        updateCard: vi.fn(() => Effect.succeed({} as any)),
        getCard: vi.fn(() => Effect.succeed(null)),
        verifyMembership: vi.fn(() => Effect.succeed({} as any)),
        verifyQRCode: vi.fn(() => Effect.succeed({} as any)),
      };

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const input: DeleteMemberInput = {
        reason: 'Delete',
        cancelStripeSubscription: false,
      };

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.deleteMember('nonexistent_123', input, 'admin_123');
      });

      const exit = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail');
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error._tag).toBe('MemberNotFoundError');
        }
      }
    });
  });

  describe('bulkImportMembers', () => {
    it('should create multiple members from valid rows', async () => {
      const authService = createTestAuthService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        createAuthUser: vi.fn((email) => Effect.succeed({uid: `user_${email}`, email})),
      });

      const databaseService = createTestDatabaseService({
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
        getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2026-000001')),
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
            totalMembers: 12,
            activeMembers: 10,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 7,
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
            totalMembers: 12,
            activeMembers: 10,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 7,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const stripeService = createTestStripeService({});

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const rows = [
        {
          email: 'member1@example.com',
          name: 'Member One',
          planType: 'individual' as const,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
        {
          email: 'member2@example.com',
          name: 'Member Two',
          planType: 'family' as const,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      ];

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.bulkImportMembers(rows, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.created).toBe(2);
      expect(result.errors).toEqual([]);
      expect(authService.createAuthUser).toHaveBeenCalledTimes(2);
      expect(databaseService.createUser).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures and return error details', async () => {
      const authService = createTestAuthService({
        getUserByEmail: vi.fn((email) => {
          if (email === 'existing@example.com') {
            return Effect.succeed({uid: 'existing_123', email});
          }
          return Effect.succeed(null);
        }),
        createAuthUser: vi.fn((email) => Effect.succeed({uid: `user_${email}`, email})),
      });

      const databaseService = createTestDatabaseService({
        getUserByEmail: vi.fn((email) => {
          if (email === 'existing@example.com') {
            return Effect.succeed({
              id: 'existing_123',
              email,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Effect.succeed(null);
        }),
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
        getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2026-000001')),
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
            totalMembers: 11,
            activeMembers: 9,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 6,
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
            totalMembers: 11,
            activeMembers: 9,
            expiredMembers: 0,
            canceledMembers: 2,
            individualCount: 6,
            familyCount: 3,
            monthlyRevenue: 0,
            yearlyRevenue: 0,
          }),
        ),
      };

      const stripeService = createTestStripeService({});

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestDatabaseLayer(databaseService),
        TestStripeLayer(stripeService),
        Layer.succeed(MembershipCardService, cardService),
        Layer.succeed(StatsService, statsService),
      );

      const rows = [
        {
          email: 'new@example.com',
          planType: 'individual' as const,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
        {
          email: 'existing@example.com', // Already exists
          planType: 'individual' as const,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      ];

      const program = Effect.gen(function* () {
        const admin = yield* AdminService;
        return yield* admin.bulkImportMembers(rows, 'admin_123', 'admin@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, AdminServiceLive), testLayer),
      );

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        row: 2,
        email: 'existing@example.com',
      });
    });
  });
});

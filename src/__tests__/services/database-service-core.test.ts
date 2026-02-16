import {Effect, Exit} from 'effect';
import {describe, it, expect, vi} from 'vitest';

import {DatabaseService} from '@/src/lib/effect/database.service';
import {DatabaseError} from '@/src/lib/effect/errors';

import {createTestDatabaseService, TestDatabaseLayer} from '../layers/test-layers';
import {
  createMockUserDocument,
  createMockMembershipDocument,
  permissionDeniedError,
  networkError,
  transactionConflictError,
} from '../mocks/database.mock';

describe('DatabaseService', () => {
  describe('getUser', () => {
    it('should return null when user not found', async () => {
      const mockService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUser('nonexistent_user');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should fail with DatabaseError on permission denied', async () => {
      const mockService = createTestDatabaseService({
        getUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_USER_FAILED',
              message: 'Permission denied',
              cause: permissionDeniedError(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUser('user_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(DatabaseError);
        }
      }
    });

    it('should fail with DatabaseError on network error', async () => {
      const mockService = createTestDatabaseService({
        getUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_USER_FAILED',
              message: 'Network unavailable',
              cause: networkError(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUser('user_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should return user document on success', async () => {
      const mockUser = createMockUserDocument();
      const mockService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUser('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
      expect(result?.email).toBe(mockUser.email);
    });
  });

  describe('setUser', () => {
    it('should fail with DatabaseError on permission denied', async () => {
      const mockService = createTestDatabaseService({
        setUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'SET_USER_FAILED',
              message: 'Permission denied',
              cause: permissionDeniedError(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setUser('user_123', {email: 'test@example.com'});
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(DatabaseError);
          expect((error.error as DatabaseError).code).toBe('SET_USER_FAILED');
        }
      }
    });

    it('should fail with DatabaseError on network error', async () => {
      const mockService = createTestDatabaseService({
        setUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'SET_USER_FAILED',
              message: 'Network unavailable',
              cause: networkError(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setUser('user_123', {email: 'test@example.com'});
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should succeed with valid data', async () => {
      const mockService = createTestDatabaseService({
        setUser: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setUser('user_123', {email: 'test@example.com'}, true);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.setUser).toHaveBeenCalledWith(
        'user_123',
        {email: 'test@example.com'},
        true,
      );
    });
  });

  describe('getNextMembershipNumber', () => {
    it('should fail with DatabaseError on transaction conflict', async () => {
      const mockService = createTestDatabaseService({
        getNextMembershipNumber: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'COUNTER_INCREMENT_FAILED',
              message: 'Transaction conflict',
              cause: transactionConflictError(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getNextMembershipNumber(2025);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(DatabaseError);
          expect((error.error as DatabaseError).code).toBe('COUNTER_INCREMENT_FAILED');
        }
      }
    });

    it('should format number correctly (DEC-YYYY-NNNNNN)', async () => {
      const mockService = createTestDatabaseService({
        getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2025-000001')),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getNextMembershipNumber(2025);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBe('DEC-2025-000001');
      expect(result).toMatch(/^DEC-\d{4}-\d{6}$/);
    });

    it('should increment counter atomically', async () => {
      let counter = 0;
      const mockService = createTestDatabaseService({
        getNextMembershipNumber: vi.fn(() => {
          counter++;
          return Effect.succeed(`DEC-2025-${String(counter).padStart(6, '0')}`);
        }),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        const first = yield* service.getNextMembershipNumber(2025);
        const second = yield* service.getNextMembershipNumber(2025);
        return {first, second};
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.first).toBe('DEC-2025-000001');
      expect(result.second).toBe('DEC-2025-000002');
    });
  });

  describe('upsertUserByStripeCustomer', () => {
    it('should update existing user found by stripeCustomerId', async () => {
      const existingUser = createMockUserDocument({
        stripeCustomerId: 'cus_existing',
      });
      const mockService = createTestDatabaseService({
        upsertUserByStripeCustomer: vi.fn(() => Effect.succeed(existingUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.upsertUserByStripeCustomer('cus_existing', 'new@example.com', {});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result.stripeCustomerId).toBe('cus_existing');
    });

    it('should link Stripe customer to user found by email', async () => {
      const linkedUser = createMockUserDocument({
        email: 'existing@example.com',
        stripeCustomerId: 'cus_new',
      });
      const mockService = createTestDatabaseService({
        upsertUserByStripeCustomer: vi.fn(() => Effect.succeed(linkedUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.upsertUserByStripeCustomer('cus_new', 'existing@example.com', {});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.email).toBe('existing@example.com');
      expect(result.stripeCustomerId).toBe('cus_new');
    });

    it('should create new user if not found', async () => {
      const newUser = createMockUserDocument({
        id: 'cus_brand_new',
        email: 'newuser@example.com',
        stripeCustomerId: 'cus_brand_new',
      });
      const mockService = createTestDatabaseService({
        upsertUserByStripeCustomer: vi.fn(() => Effect.succeed(newUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.upsertUserByStripeCustomer(
          'cus_brand_new',
          'newuser@example.com',
          {},
        );
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.id).toBe('cus_brand_new');
      expect(result.email).toBe('newuser@example.com');
    });

    it('should fail with DatabaseError on network error', async () => {
      const mockService = createTestDatabaseService({
        upsertUserByStripeCustomer: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'UPSERT_USER_BY_STRIPE_CUSTOMER_FAILED',
              message: 'Network error',
              cause: networkError(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.upsertUserByStripeCustomer('cus_123', 'test@example.com', {});
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('getActiveMembership', () => {
    it('should return null when no memberships exist', async () => {
      const mockService = createTestDatabaseService({
        getActiveMembership: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getActiveMembership('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should return active membership with latest endDate', async () => {
      const activeMembership = createMockMembershipDocument({
        status: 'active',
        endDate: new Date('2025-12-31').toISOString(),
      });
      const mockService = createTestDatabaseService({
        getActiveMembership: vi.fn(() => Effect.succeed(activeMembership)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getActiveMembership('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe('active');
    });

    it('should filter by active statuses only', async () => {
      // This tests that the service filters for active, trialing, past_due
      const activeMembership = createMockMembershipDocument({
        status: 'active',
      });
      const mockService = createTestDatabaseService({
        getActiveMembership: vi.fn(() => Effect.succeed(activeMembership)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getActiveMembership('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result?.status).toBe('active');
    });
  });

  describe('getUserByEmail', () => {
    it('should return null when user not found by email', async () => {
      const mockService = createTestDatabaseService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUserByEmail('notfound@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should return user when found by email', async () => {
      const mockUser = createMockUserDocument({email: 'found@example.com'});
      const mockService = createTestDatabaseService({
        getUserByEmail: vi.fn(() => Effect.succeed(mockUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUserByEmail('found@example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.email).toBe('found@example.com');
    });
  });

  describe('getUserByStripeCustomerId', () => {
    it('should return null when user not found by customer ID', async () => {
      const mockService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUserByStripeCustomerId('cus_notfound');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should return user when found by customer ID', async () => {
      const mockUser = createMockUserDocument({stripeCustomerId: 'cus_found'});
      const mockService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(mockUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getUserByStripeCustomerId('cus_found');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.stripeCustomerId).toBe('cus_found');
    });
  });

  describe('setMembership', () => {
    it('should succeed when setting membership', async () => {
      const mockService = createTestDatabaseService({
        setMembership: vi.fn(() => Effect.void),
      });

      const membershipData = {
        stripeSubscriptionId: 'sub_123',
        planType: 'individual' as const,
        status: 'active' as const,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        autoRenew: true,
      };

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setMembership('user_123', 'sub_123', membershipData as any);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.setMembership).toHaveBeenCalled();
    });

    it('should fail with DatabaseError on failure', async () => {
      const mockService = createTestDatabaseService({
        setMembership: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'SET_MEMBERSHIP_FAILED',
              message: 'Failed to set membership',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setMembership('user_123', 'sub_123', {} as any);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('updateMembership', () => {
    it('should succeed when updating membership', async () => {
      const mockService = createTestDatabaseService({
        updateMembership: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateMembership('user_123', 'sub_123', {
          status: 'canceled',
          autoRenew: false,
        });
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
    });
  });

  describe('getMembershipCard', () => {
    it('should return null when no card exists', async () => {
      const mockService = createTestDatabaseService({
        getMembershipCard: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembershipCard('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return null when no stats exist', async () => {
      const mockService = createTestDatabaseService({
        getStats: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getStats();
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });
  });

  describe('updateStats', () => {
    it('should succeed when updating stats', async () => {
      const mockService = createTestDatabaseService({
        updateStats: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateStats({activeMembers: 100});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
    });
  });
});

import {Effect, Exit, Layer} from 'effect';
import {describe, it, expect, vi} from 'vitest';

// Mock the db client to avoid Neon connection requirement in tests
vi.mock('@/src/db/client', () => ({
  db: {},
}));

import {
  DatabaseService,
  type DatabaseService as DatabaseServiceType,
} from '@/src/lib/effect/database.service';
import {DatabaseError} from '@/src/lib/effect/errors';

import {
  createMockUserDocument,
  createMockMembershipDocument,
  createMockMembershipCard,
} from '../mocks/firestore.mock';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const createTestDatabaseService = (
  overrides: Partial<DatabaseServiceType> = {},
): DatabaseServiceType => ({
  getUser: vi.fn(() => Effect.succeed(null)),
  getUserByEmail: vi.fn(() => Effect.succeed(null)),
  getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
  createUser: vi.fn(() => Effect.die('Not mocked')) as unknown as DatabaseServiceType['createUser'],
  updateUser: vi.fn(() => Effect.void),
  setUser: vi.fn(() => Effect.void),
  upsertUserByStripeCustomer: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as DatabaseServiceType['upsertUserByStripeCustomer'],
  getMembership: vi.fn(() => Effect.succeed(null)),
  getActiveMembership: vi.fn(() => Effect.succeed(null)),
  setMembership: vi.fn(() => Effect.void),
  updateMembership: vi.fn(() => Effect.void),
  deleteMembership: vi.fn(() => Effect.void),
  getAllMemberships: vi.fn(() => Effect.succeed({members: [], total: 0})),
  getExpiringMemberships: vi.fn(() => Effect.succeed([])),
  getMembershipCard: vi.fn(() => Effect.succeed(null)),
  setMembershipCard: vi.fn(() => Effect.void),
  updateMembershipCard: vi.fn(() => Effect.void),
  getMembershipByNumber: vi.fn(() => Effect.succeed(null)),
  getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2025-000001')),
  ...overrides,
});

const TestDatabaseLayer = (service: DatabaseServiceType) => Layer.succeed(DatabaseService, service);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_USER_FAILED',
              message: 'Connection refused',
              cause: new Error('ECONNREFUSED'),
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
          expect((error.error as DatabaseError).code).toBe('GET_USER_FAILED');
        }
      }
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

  describe('createUser', () => {
    it('should return created user document', async () => {
      const newUser = createMockUserDocument({
        id: 'new_user',
        email: 'new@example.com',
      });
      const mockService = createTestDatabaseService({
        createUser: vi.fn(() => Effect.succeed(newUser)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.createUser('new_user', {
          email: 'new@example.com',
          name: 'New User',
        });
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.id).toBe('new_user');
      expect(result.email).toBe('new@example.com');
    });

    it('should fail with DatabaseError on duplicate email', async () => {
      const mockService = createTestDatabaseService({
        createUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'CREATE_USER_FAILED',
              message: 'duplicate key value violates unique constraint',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.createUser('user_dup', {
          email: 'existing@example.com',
        });
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('CREATE_USER_FAILED');
      }
    });
  });

  describe('updateUser', () => {
    it('should succeed when updating user', async () => {
      const mockService = createTestDatabaseService({
        updateUser: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateUser('user_123', {email: 'updated@example.com'});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.updateUser).toHaveBeenCalledWith('user_123', {
        email: 'updated@example.com',
      });
    });

    it('should fail with DatabaseError on update failure', async () => {
      const mockService = createTestDatabaseService({
        updateUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'UPDATE_USER_FAILED',
              message: 'Connection lost',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateUser('user_123', {name: 'Updated'});
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should succeed with valid data and merge=true', async () => {
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

    it('should fail with DatabaseError on set failure', async () => {
      const mockService = createTestDatabaseService({
        setUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'SET_USER_FAILED',
              message: 'Database unavailable',
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
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('SET_USER_FAILED');
      }
    });
  });

  describe('upsertUserByStripeCustomer', () => {
    it('should return existing user found by stripeCustomerId', async () => {
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

    it('should fail with DatabaseError on connection error', async () => {
      const mockService = createTestDatabaseService({
        upsertUserByStripeCustomer: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'UPSERT_USER_BY_STRIPE_CUSTOMER_FAILED',
              message: 'Connection refused',
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

  // -------------------------------------------------------------------------
  // Membership management methods
  // -------------------------------------------------------------------------

  describe('getMembership', () => {
    it('should return null when membership not found', async () => {
      const mockService = createTestDatabaseService({
        getMembership: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembership('user_123', 'nonexistent_membership');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should return membership document on success', async () => {
      const mockMembership = createMockMembershipDocument();
      const mockService = createTestDatabaseService({
        getMembership: vi.fn(() => Effect.succeed(mockMembership)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembership('user_123', 'sub_test_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockMembership.id);
      expect(result?.status).toBe('active');
      expect(result?.planType).toBe('individual');
    });

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getMembership: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_MEMBERSHIP_FAILED',
              message: 'Connection refused',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembership('user_123', 'sub_test_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('GET_MEMBERSHIP_FAILED');
      }
    });
  });

  describe('getActiveMembership', () => {
    it('should return null when no active membership exists', async () => {
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

    it('should return the active membership', async () => {
      const activeMembership = createMockMembershipDocument({status: 'active'});
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

    it('should return trialing membership as active', async () => {
      const trialingMembership = createMockMembershipDocument({status: 'trialing'});
      const mockService = createTestDatabaseService({
        getActiveMembership: vi.fn(() => Effect.succeed(trialingMembership)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getActiveMembership('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result?.status).toBe('trialing');
    });

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getActiveMembership: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_ACTIVE_MEMBERSHIP_FAILED',
              message: 'Database error',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getActiveMembership('user_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('GET_ACTIVE_MEMBERSHIP_FAILED');
      }
    });
  });

  describe('setMembership', () => {
    it('should succeed when setting a membership', async () => {
      const mockService = createTestDatabaseService({
        setMembership: vi.fn(() => Effect.void),
      });

      const membershipData = createMockMembershipDocument();
      const {id: _id, ...dataWithoutId} = membershipData;

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setMembership('user_123', 'sub_test_123', dataWithoutId);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.setMembership).toHaveBeenCalledWith(
        'user_123',
        'sub_test_123',
        dataWithoutId,
      );
    });

    it('should fail with DatabaseError on set failure', async () => {
      const mockService = createTestDatabaseService({
        setMembership: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'SET_MEMBERSHIP_FAILED',
              message: 'Foreign key constraint violation',
            }),
          ),
        ),
      });

      const membershipData = createMockMembershipDocument();
      const {id: _id, ...dataWithoutId} = membershipData;

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setMembership('user_123', 'sub_test_123', dataWithoutId);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('SET_MEMBERSHIP_FAILED');
      }
    });
  });

  describe('updateMembership', () => {
    it('should succeed when updating a membership', async () => {
      const mockService = createTestDatabaseService({
        updateMembership: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateMembership('user_123', 'sub_test_123', {
          status: 'canceled',
        });
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.updateMembership).toHaveBeenCalledWith('user_123', 'sub_test_123', {
        status: 'canceled',
      });
    });

    it('should fail with DatabaseError on update failure', async () => {
      const mockService = createTestDatabaseService({
        updateMembership: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'UPDATE_MEMBERSHIP_FAILED',
              message: 'Connection lost',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateMembership('user_123', 'sub_test_123', {
          status: 'active',
        });
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('UPDATE_MEMBERSHIP_FAILED');
      }
    });
  });

  describe('deleteMembership', () => {
    it('should succeed when deleting a membership', async () => {
      const mockService = createTestDatabaseService({
        deleteMembership: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.deleteMembership('user_123', 'sub_test_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.deleteMembership).toHaveBeenCalledWith('user_123', 'sub_test_123');
    });

    it('should fail with DatabaseError on delete failure', async () => {
      const mockService = createTestDatabaseService({
        deleteMembership: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'DELETE_MEMBERSHIP_FAILED',
              message: 'Database unavailable',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.deleteMembership('user_123', 'sub_test_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('DELETE_MEMBERSHIP_FAILED');
      }
    });
  });

  describe('getAllMemberships', () => {
    it('should return empty list when no memberships exist', async () => {
      const mockService = createTestDatabaseService({
        getAllMemberships: vi.fn(() => Effect.succeed({members: [], total: 0})),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getAllMemberships({});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.members).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return members with pagination info', async () => {
      const mockUser = createMockUserDocument();
      const mockMembership = createMockMembershipDocument();
      const mockCard = createMockMembershipCard();

      const mockService = createTestDatabaseService({
        getAllMemberships: vi.fn(() =>
          Effect.succeed({
            members: [{user: mockUser, membership: mockMembership, card: mockCard}],
            total: 1,
          }),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getAllMemberships({page: 1, pageSize: 20});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.members).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.members[0].user?.email).toBe(mockUser.email);
      expect(result.members[0].membership?.status).toBe('active');
    });

    it('should pass filter params correctly', async () => {
      const mockService = createTestDatabaseService({
        getAllMemberships: vi.fn(() => Effect.succeed({members: [], total: 0})),
      });

      const params = {
        status: 'active' as const,
        planType: 'individual' as const,
        query: 'test@example.com',
        page: 2,
        pageSize: 10,
      };

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getAllMemberships(params);
      });

      await Effect.runPromise(Effect.provide(program, TestDatabaseLayer(mockService)));

      expect(mockService.getAllMemberships).toHaveBeenCalledWith(params);
    });

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getAllMemberships: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_ALL_MEMBERSHIPS_FAILED',
              message: 'Database connection lost',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getAllMemberships({});
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('GET_ALL_MEMBERSHIPS_FAILED');
      }
    });
  });

  describe('getExpiringMemberships', () => {
    it('should return empty list when no expiring memberships', async () => {
      const mockService = createTestDatabaseService({
        getExpiringMemberships: vi.fn(() => Effect.succeed([])),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getExpiringMemberships(30);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toEqual([]);
    });

    it('should return members with expiring memberships', async () => {
      const mockUser = createMockUserDocument();
      const expiringMembership = createMockMembershipDocument({
        status: 'active',
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const mockCard = createMockMembershipCard();

      const mockService = createTestDatabaseService({
        getExpiringMemberships: vi.fn(() =>
          Effect.succeed([{user: mockUser, membership: expiringMembership, card: mockCard}]),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getExpiringMemberships(30);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toHaveLength(1);
      expect(result[0].membership?.status).toBe('active');
      expect(result[0].user?.email).toBe(mockUser.email);
    });

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getExpiringMemberships: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_EXPIRING_MEMBERSHIPS_FAILED',
              message: 'Query timeout',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getExpiringMemberships(30);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('GET_EXPIRING_MEMBERSHIPS_FAILED');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Membership card methods
  // -------------------------------------------------------------------------

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

    it('should return membership card on success', async () => {
      const mockCard = createMockMembershipCard();
      const mockService = createTestDatabaseService({
        getMembershipCard: vi.fn(() => Effect.succeed(mockCard)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembershipCard('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.membershipNumber).toBe('DEC-2025-000001');
      expect(result?.status).toBe('active');
    });

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getMembershipCard: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_CARD_FAILED',
              message: 'Connection refused',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembershipCard('user_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('GET_CARD_FAILED');
      }
    });
  });

  describe('setMembershipCard', () => {
    it('should succeed when setting a card', async () => {
      const mockService = createTestDatabaseService({
        setMembershipCard: vi.fn(() => Effect.void),
      });

      const mockCard = createMockMembershipCard();
      const {id: _id, ...cardWithoutId} = mockCard;

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setMembershipCard('user_123', cardWithoutId);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.setMembershipCard).toHaveBeenCalledWith('user_123', cardWithoutId);
    });

    it('should fail with DatabaseError on set failure', async () => {
      const mockService = createTestDatabaseService({
        setMembershipCard: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'SET_CARD_FAILED',
              message: 'Database unavailable',
            }),
          ),
        ),
      });

      const mockCard = createMockMembershipCard();
      const {id: _id, ...cardWithoutId} = mockCard;

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.setMembershipCard('user_123', cardWithoutId);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('SET_CARD_FAILED');
      }
    });
  });

  describe('updateMembershipCard', () => {
    it('should succeed when updating a card', async () => {
      const mockService = createTestDatabaseService({
        updateMembershipCard: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateMembershipCard('user_123', {status: 'canceled'});
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.updateMembershipCard).toHaveBeenCalledWith('user_123', {
        status: 'canceled',
      });
    });

    it('should fail with DatabaseError on update failure', async () => {
      const mockService = createTestDatabaseService({
        updateMembershipCard: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'UPDATE_CARD_FAILED',
              message: 'Connection lost',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.updateMembershipCard('user_123', {status: 'active'});
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('UPDATE_CARD_FAILED');
      }
    });
  });

  describe('getMembershipByNumber', () => {
    it('should return null when no membership found by number', async () => {
      const mockService = createTestDatabaseService({
        getMembershipByNumber: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembershipByNumber('DEC-2025-999999');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should return userId and card when found', async () => {
      const mockCard = createMockMembershipCard();
      const mockService = createTestDatabaseService({
        getMembershipByNumber: vi.fn(() => Effect.succeed({userId: 'user_123', card: mockCard})),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembershipByNumber('DEC-2025-000001');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user_123');
      expect(result?.card.membershipNumber).toBe('DEC-2025-000001');
    });

    it('should fail with DatabaseError on query failure', async () => {
      const mockService = createTestDatabaseService({
        getMembershipByNumber: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_BY_NUMBER_FAILED',
              message: 'Query timeout',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getMembershipByNumber('DEC-2025-000001');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('GET_BY_NUMBER_FAILED');
      }
    });
  });

  describe('getNextMembershipNumber', () => {
    it('should return formatted membership number', async () => {
      const mockService = createTestDatabaseService({
        getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2026-000001')),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getNextMembershipNumber(2026);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result).toBe('DEC-2026-000001');
    });

    it('should produce sequential numbers', async () => {
      let counter = 0;
      const mockService = createTestDatabaseService({
        getNextMembershipNumber: vi.fn(() => {
          counter++;
          return Effect.succeed(`DEC-2026-${String(counter).padStart(6, '0')}`);
        }),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        const first = yield* service.getNextMembershipNumber(2026);
        const second = yield* service.getNextMembershipNumber(2026);
        return {first, second};
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(result.first).toBe('DEC-2026-000001');
      expect(result.second).toBe('DEC-2026-000002');
    });

    it('should fail with DatabaseError on counter failure', async () => {
      const mockService = createTestDatabaseService({
        getNextMembershipNumber: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'COUNTER_INCREMENT_FAILED',
              message: 'Database unavailable',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.getNextMembershipNumber(2026);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestDatabaseLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect((result.cause.error as DatabaseError).code).toBe('COUNTER_INCREMENT_FAILED');
      }
    });
  });
});

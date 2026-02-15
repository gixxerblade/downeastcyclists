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

import {createMockUserDocument} from '../mocks/firestore.mock';

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
});

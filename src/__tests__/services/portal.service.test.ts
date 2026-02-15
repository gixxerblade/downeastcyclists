import {Effect, Exit, Layer} from 'effect';
import {describe, it, expect, vi} from 'vitest';

import {SessionError, StripeError, NotFoundError} from '@/src/lib/effect/errors';
import {PortalService, PortalServiceLive} from '@/src/lib/effect/portal.service';

import {
  createTestAuthService,
  createTestStripeService,
  createTestDatabaseService,
  TestAuthLayer,
  TestStripeLayer,
  TestDatabaseLayer,
} from '../layers/test-layers';
import {createMockUserDocument, createMockMembershipDocument} from '../mocks/database.mock';
import {createMockDecodedToken} from '../mocks/firebase-admin.mock';
import {createMockPortalSession} from '../mocks/stripe.mock';

describe('PortalService', () => {
  describe('verifySession', () => {
    it('should fail with SessionError on invalid session', async () => {
      const authService = createTestAuthService({
        verifySessionCookie: vi.fn(() =>
          Effect.fail(
            new SessionError({
              code: 'SESSION_INVALID',
              message: 'Session is invalid',
            }),
          ),
        ),
      });
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.verifySession('invalid_session');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(SessionError);
        }
      }
    });

    it('should return uid and email on valid session', async () => {
      const mockDecodedToken = createMockDecodedToken({
        uid: 'user_123',
        email: 'test@example.com',
      });
      const authService = createTestAuthService({
        verifySessionCookie: vi.fn(() => Effect.succeed(mockDecodedToken as any)),
      });
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.verifySession('valid_session');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result).toBeDefined();
      expect(result.uid).toBe('user_123');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('getMemberDashboard', () => {
    it('should fail with NotFoundError when user not found', async () => {
      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.getMemberDashboard('nonexistent_user');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(NotFoundError);
          expect((error.error as NotFoundError).resource).toBe('user');
        }
      }
    });

    it('should return null membership when no active membership', async () => {
      const mockUser = createMockUserDocument();
      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
        getActiveMembership: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.getMemberDashboard('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result).toBeDefined();
      expect(result.membership).toBeNull();
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should calculate daysRemaining correctly', async () => {
      const mockUser = createMockUserDocument();
      // Set endDate to 30 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const mockMembership = createMockMembershipDocument({
        status: 'active',
        endDate: futureDate.toISOString(),
      });

      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
        getActiveMembership: vi.fn(() => Effect.succeed(mockMembership)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.getMemberDashboard('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result.membership).toBeDefined();
      // Should be approximately 30 days (allowing for small timing variations)
      expect(result.membership?.daysRemaining).toBeGreaterThanOrEqual(29);
      expect(result.membership?.daysRemaining).toBeLessThanOrEqual(31);
    });

    it('should set canManageSubscription based on stripeCustomerId', async () => {
      const mockUserWithStripe = createMockUserDocument({
        stripeCustomerId: 'cus_123',
      });
      const mockMembership = createMockMembershipDocument();

      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUserWithStripe)),
        getActiveMembership: vi.fn(() => Effect.succeed(mockMembership)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.getMemberDashboard('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result.canManageSubscription).toBe(true);
    });

    it('should set canManageSubscription false when no stripeCustomerId', async () => {
      const mockUserNoStripe = createMockUserDocument({
        stripeCustomerId: undefined,
      });
      const mockMembership = createMockMembershipDocument();

      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUserNoStripe)),
        getActiveMembership: vi.fn(() => Effect.succeed(mockMembership)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.getMemberDashboard('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result.canManageSubscription).toBe(false);
    });
  });

  describe('createPortalSession', () => {
    it('should fail with NotFoundError when user not found', async () => {
      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.createPortalSession('nonexistent_user', 'https://example.com');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(NotFoundError);
          expect((error.error as NotFoundError).resource).toBe('user');
        }
      }
    });

    it('should fail with NotFoundError when no stripeCustomerId', async () => {
      const mockUser = createMockUserDocument({
        stripeCustomerId: undefined,
      });
      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.createPortalSession('user_123', 'https://example.com');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(NotFoundError);
          expect((error.error as NotFoundError).resource).toBe('stripeCustomer');
        }
      }
    });

    it('should fail with StripeError when portal creation fails', async () => {
      const mockUser = createMockUserDocument({
        stripeCustomerId: 'cus_123',
      });
      const authService = createTestAuthService();
      const stripeService = createTestStripeService({
        createPortalSession: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'PORTAL_CREATE_FAILED',
              message: 'Portal creation failed',
            }),
          ),
        ),
      });
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.createPortalSession('user_123', 'https://example.com');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
        }
      }
    });

    it('should return portal URL on success', async () => {
      const mockUser = createMockUserDocument({
        stripeCustomerId: 'cus_123',
      });
      const mockPortalSession = createMockPortalSession({
        url: 'https://billing.stripe.com/portal/session123',
      });
      const authService = createTestAuthService();
      const stripeService = createTestStripeService({
        createPortalSession: vi.fn(() => Effect.succeed(mockPortalSession)),
      });
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.createPortalSession('user_123', 'https://example.com');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result).toBeDefined();
      expect(result.url).toBe('https://billing.stripe.com/portal/session123');
    });
  });

  describe('linkFirebaseToStripe', () => {
    it('should call setUser with stripeCustomerId', async () => {
      const authService = createTestAuthService();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        setUser: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.mergeAll(
        TestAuthLayer(authService),
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* PortalService;
        return yield* service.linkFirebaseToStripe('firebase_uid_123', 'cus_stripe_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, PortalServiceLive), testLayer),
      );

      expect(result).toBeUndefined();
      expect(databaseService.setUser).toHaveBeenCalledWith('firebase_uid_123', {
        stripeCustomerId: 'cus_stripe_123',
      });
    });
  });
});

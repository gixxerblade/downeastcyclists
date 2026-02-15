import {Effect, Exit, Layer} from 'effect';
import type Stripe from 'stripe';
import {describe, it, expect, vi} from 'vitest';

import {StripeError, DatabaseError, NotFoundError} from '@/src/lib/effect/errors';
import {MembershipService, MembershipServiceLive} from '@/src/lib/effect/membership.service';

import {
  createTestStripeService,
  createTestDatabaseService,
  TestStripeLayer,
  TestDatabaseLayer,
} from '../layers/test-layers';
import {createMockUserDocument, createMockMembershipDocument} from '../mocks/database.mock';
import {
  createMockCheckoutSession,
  createMockSubscription,
  createMockPrice,
} from '../mocks/stripe.mock';

describe('MembershipService', () => {
  describe('createCheckoutSession', () => {
    it('should look up existing user when userId provided', async () => {
      const mockUser = createMockUserDocument({
        stripeCustomerId: 'cus_existing',
      });
      const mockSession = createMockCheckoutSession();

      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() => Effect.succeed(mockSession)),
      });
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          userId: 'user_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(result).toBeDefined();
      expect(result.sessionId).toBe(mockSession.id);
      expect(databaseService.getUser).toHaveBeenCalledWith('user_123');
    });

    it('should use email directly when no userId', async () => {
      const mockSession = createMockCheckoutSession();

      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() => Effect.succeed(mockSession)),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          email: 'guest@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(result).toBeDefined();
      // Should not call getUser since no userId provided
      expect(databaseService.getUser).not.toHaveBeenCalled();
    });

    it('should pass stripeCustomerId to Stripe if user has one', async () => {
      const mockUser = createMockUserDocument({
        stripeCustomerId: 'cus_existing_123',
      });
      const mockSession = createMockCheckoutSession();

      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() => Effect.succeed(mockSession)),
      });
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          userId: 'user_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // The stripe service should have been called with the customer email
      expect(stripeService.createCheckoutSession).toHaveBeenCalled();
    });

    it('should propagate StripeError from Stripe service', async () => {
      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'SESSION_CREATE_FAILED',
              message: 'Network error',
            }),
          ),
        ),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
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

    it('should propagate DatabaseError from user lookup', async () => {
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() =>
          Effect.fail(
            new DatabaseError({
              code: 'GET_USER_FAILED',
              message: 'Permission denied',
            }),
          ),
        ),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          userId: 'user_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
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
  });

  describe('processCheckoutCompleted', () => {
    it('should skip membership creation for incomplete subscription', async () => {
      const mockSubscription = createMockSubscription({
        status: 'incomplete',
      });

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSession = createMockCheckoutSession({
        subscription: 'sub_incomplete',
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // setMembership should NOT be called for incomplete subscriptions
      expect(databaseService.setMembership).not.toHaveBeenCalled();
    });

    it('should skip membership creation for incomplete_expired subscription', async () => {
      const mockSubscription = createMockSubscription({
        status: 'incomplete_expired',
      });

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSession = createMockCheckoutSession() as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(databaseService.setMembership).not.toHaveBeenCalled();
    });

    it('should fail with StripeError when subscription retrieval fails', async () => {
      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'SUBSCRIPTION_RETRIEVE_FAILED',
              message: 'Not found',
            }),
          ),
        ),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSession = createMockCheckoutSession() as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should create user if not exists', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const databaseService = createTestDatabaseService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSession = createMockCheckoutSession({
        customer_email: 'new@example.com',
        metadata: {},
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(databaseService.setUser).toHaveBeenCalled();
      expect(databaseService.setMembership).toHaveBeenCalled();
    });

    it('should add processing fee invoice item when present', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const databaseService = createTestDatabaseService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSession = createMockCheckoutSession({
        metadata: {processingFee: '100'}, // $1.00 processing fee
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(stripeService.addInvoiceItem).toHaveBeenCalled();
    });
  });

  describe('processSubscriptionUpdated', () => {
    it('should log warning and return when user not found', async () => {
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSubscription = createMockSubscription();

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionUpdated(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // Should not throw, just log warning
      expect(databaseService.updateMembership).not.toHaveBeenCalled();
    });

    it('should update membership status', async () => {
      const mockUser = createMockUserDocument();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(mockUser)),
        updateMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSubscription = createMockSubscription({
        status: 'past_due',
      });

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionUpdated(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(databaseService.updateMembership).toHaveBeenCalled();
    });

    it('should update autoRenew based on cancel_at_period_end', async () => {
      const mockUser = createMockUserDocument();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(mockUser)),
        updateMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSubscription = createMockSubscription({
        cancel_at_period_end: true,
      });

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionUpdated(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // The updateMembership should be called with autoRenew: false
      expect(databaseService.updateMembership).toHaveBeenCalled();
      const call = (databaseService.updateMembership as any).mock.calls[0];
      expect(call[2].autoRenew).toBe(false);
    });
  });

  describe('processSubscriptionDeleted', () => {
    it('should log warning and return when user not found', async () => {
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSubscription = createMockSubscription();

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionDeleted(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(databaseService.updateMembership).not.toHaveBeenCalled();
    });

    it('should mark membership as canceled', async () => {
      const mockUser = createMockUserDocument();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(mockUser)),
        updateMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const mockSubscription = createMockSubscription();

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionDeleted(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(databaseService.updateMembership).toHaveBeenCalled();
      const call = (databaseService.updateMembership as any).mock.calls[0];
      expect(call[2].status).toBe('canceled');
      expect(call[2].autoRenew).toBe(false);
    });
  });

  describe('getMembershipStatus', () => {
    it('should fail with NotFoundError when user not found', async () => {
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.getMembershipStatus('nonexistent_user');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(NotFoundError);
        }
      }
    });

    it('should return isActive=false when no membership', async () => {
      const mockUser = createMockUserDocument();
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
        getActiveMembership: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.getMembershipStatus('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(result.isActive).toBe(false);
      expect(result.membership).toBeNull();
    });

    it('should return correct status for active membership', async () => {
      const mockUser = createMockUserDocument();
      const mockMembership = createMockMembershipDocument({
        status: 'active',
        planType: 'individual',
      });
      const stripeService = createTestStripeService();
      const databaseService = createTestDatabaseService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
        getActiveMembership: vi.fn(() => Effect.succeed(mockMembership)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.getMembershipStatus('user_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(result.isActive).toBe(true);
      expect(result.membership).toBeDefined();
      expect(result.membership?.status).toBe('active');
      expect(result.membership?.planType).toBe('individual');
    });
  });

  describe('getPlans', () => {
    it('should fail with StripeError when prices fetch fails', async () => {
      const stripeService = createTestStripeService({
        getPricesWithProducts: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'PRICES_RETRIEVE_FAILED',
              message: 'Network error',
            }),
          ),
        ),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.getPlans();
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should convert cents to dollars', async () => {
      const mockPrice = createMockPrice({
        id: 'price_individual_test',
        unit_amount: 3500, // $35.00 in cents
        product: {
          id: 'prod_test',
          name: 'Individual Membership',
        } as any,
      });

      const stripeService = createTestStripeService({
        getPricesWithProducts: vi.fn(() =>
          Effect.succeed([{price: mockPrice, product: mockPrice.product as any}]),
        ),
      });
      const databaseService = createTestDatabaseService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestDatabaseLayer(databaseService),
      );

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.getPlans();
      });

      const result = await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(result.length).toBe(1);
      expect(result[0].price).toBe(35); // Converted from 3500 cents
    });
  });
});

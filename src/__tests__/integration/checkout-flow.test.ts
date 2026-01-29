import {Effect, Exit, Layer} from 'effect';
import type Stripe from 'stripe';
import {describe, it, expect, vi} from 'vitest';

import {FirestoreError} from '@/src/lib/effect/errors';
import {MembershipService, MembershipServiceLive} from '@/src/lib/effect/membership.service';

import {
  createTestStripeService,
  createTestFirestoreService,
  TestStripeLayer,
  TestFirestoreLayer,
} from '../layers/test-layers';
import {createMockUserDocument} from '../mocks/firestore.mock';
import {createMockCheckoutSession, createMockSubscription} from '../mocks/stripe.mock';

describe('Checkout Flow Integration', () => {
  describe('successful checkout', () => {
    it('should create checkout session with user data', async () => {
      const mockUser = createMockUserDocument({
        stripeCustomerId: 'cus_existing',
        email: 'existing@example.com',
      });
      const mockSession = createMockCheckoutSession({
        id: 'cs_success_123',
        url: 'https://checkout.stripe.com/success',
      });

      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() => Effect.succeed(mockSession)),
      });
      const firestoreService = createTestFirestoreService({
        getUser: vi.fn(() => Effect.succeed(mockUser)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
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

      expect(result.sessionId).toBe('cs_success_123');
      expect(result.url).toBe('https://checkout.stripe.com/success');
      expect(firestoreService.getUser).toHaveBeenCalledWith('user_123');
    });

    it('should process webhook and create membership', async () => {
      const mockSubscription = createMockSubscription({
        id: 'sub_new_123',
        status: 'active',
      });

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
        updateStats: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        customer: 'cus_new_123',
        customer_email: 'new@example.com',
        subscription: 'sub_new_123',
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(firestoreService.setUser).toHaveBeenCalled();
      expect(firestoreService.setMembership).toHaveBeenCalled();

      // Verify membership was created with correct subscription ID
      const setMembershipCall = (firestoreService.setMembership as any).mock.calls[0];
      expect(setMembershipCall[1]).toBe('sub_new_123'); // membershipId = subscriptionId
    });
  });

  describe('payment failure scenarios', () => {
    it('should not create membership on card_declined', async () => {
      const mockSubscription = createMockSubscription({
        status: 'incomplete',
      });

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        subscription: 'sub_declined',
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // Membership should NOT be created for incomplete subscription
      expect(firestoreService.setMembership).not.toHaveBeenCalled();
    });

    it('should not create membership on insufficient_funds', async () => {
      const mockSubscription = createMockSubscription({
        status: 'incomplete',
      });

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService();

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession() as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(firestoreService.setMembership).not.toHaveBeenCalled();
    });

    it('should leave user in consistent state after payment failure', async () => {
      const mockSubscription = createMockSubscription({
        status: 'incomplete_expired',
      });

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession() as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // User document should NOT be created/updated for failed payments
      expect(firestoreService.setUser).not.toHaveBeenCalled();
      expect(firestoreService.setMembership).not.toHaveBeenCalled();
    });
  });

  describe('Firestore failure during checkout', () => {
    it('should handle user lookup failure gracefully', async () => {
      const stripeService = createTestStripeService();
      const firestoreService = createTestFirestoreService({
        getUser: vi.fn(() =>
          Effect.fail(
            new FirestoreError({
              code: 'GET_USER_FAILED',
              message: 'Database unavailable',
            }),
          ),
        ),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
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
          expect(error.error).toBeInstanceOf(FirestoreError);
        }
      }
    });

    it('should fail checkout if Firestore write fails after payment', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() =>
          Effect.fail(
            new FirestoreError({
              code: 'SET_USER_FAILED',
              message: 'Write failed',
            }),
          ),
        ),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
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
  });

  describe('partial failure recovery', () => {
    it('should allow retry when membership creation fails', async () => {
      let callCount = 0;
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return Effect.fail(
              new FirestoreError({
                code: 'SET_MEMBERSHIP_FAILED',
                message: 'Temporary failure',
              }),
            );
          }
          return Effect.void;
        }),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession() as Stripe.Checkout.Session;

      // First attempt fails
      const program1 = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      const result1 = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program1, MembershipServiceLive), testLayer),
      );

      expect(Exit.isFailure(result1)).toBe(true);

      // Second attempt succeeds
      const program2 = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      const result2 = await Effect.runPromiseExit(
        Effect.provide(Effect.provide(program2, MembershipServiceLive), testLayer),
      );

      expect(Exit.isSuccess(result2)).toBe(true);
    });

    it('should detect existing user and link correctly on retry', async () => {
      const existingUser = createMockUserDocument({
        id: 'existing_user_123',
        email: 'retry@example.com',
        stripeCustomerId: undefined,
      });
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(existingUser)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        customer_email: 'retry@example.com',
        metadata: {},
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      // Should use existing user's ID for membership
      expect(firestoreService.setMembership).toHaveBeenCalled();
      const setMembershipCall = (firestoreService.setMembership as any).mock.calls[0];
      expect(setMembershipCall[0]).toBe('existing_user_123');
    });
  });

  describe('processing fee handling', () => {
    it('should add processing fee when specified in metadata', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        customer: 'cus_123',
        metadata: {processingFee: '100'}, // $1.00 fee
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(stripeService.addInvoiceItem).toHaveBeenCalled();
      const invoiceCall = (stripeService.addInvoiceItem as any).mock.calls[0];
      expect(invoiceCall[0]).toBe('cus_123');
      expect(invoiceCall[1]).toBe(100);
    });

    it('should not add processing fee when zero', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.void),
        setMembership: vi.fn(() => Effect.void),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        metadata: {processingFee: '0'},
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(stripeService.addInvoiceItem).not.toHaveBeenCalled();
    });
  });
});

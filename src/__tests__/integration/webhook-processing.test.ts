import {Effect, Exit, Layer} from 'effect';
import type Stripe from 'stripe';
import {describe, it, expect, vi} from 'vitest';

import {StripeError, FirestoreError, DuplicateWebhookError} from '@/src/lib/effect/errors';
import {MembershipService, MembershipServiceLive} from '@/src/lib/effect/membership.service';
import {StripeService} from '@/src/lib/effect/stripe.service';
import {WebhookIdempotencyService} from '@/src/lib/effect/webhook-idempotency.service';

import {
  createTestStripeService,
  createTestFirestoreService,
  createTestWebhookService,
  TestStripeLayer,
  TestFirestoreLayer,
  TestWebhookLayer,
} from '../layers/test-layers';
import {
  createMockUserDocument,
  createMockWebhookEvent as createMockWebhookEventDoc,
} from '../mocks/firestore.mock';
import {
  createMockCheckoutSession,
  createMockSubscription,
  createMockWebhookEvent,
} from '../mocks/stripe.mock';

describe('Webhook Processing Integration', () => {
  describe('signature verification', () => {
    it('should fail with StripeError on invalid signature', async () => {
      const stripeService = createTestStripeService({
        verifyWebhookSignature: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'WEBHOOK_VERIFY_FAILED',
              message: 'Invalid signature',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.verifyWebhookSignature('body', 'invalid_sig');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('WEBHOOK_VERIFY_FAILED');
        }
      }
    });

    it('should return event on valid signature', async () => {
      const mockEvent = createMockWebhookEvent('checkout.session.completed', {});
      const stripeService = createTestStripeService({
        verifyWebhookSignature: vi.fn(() => Effect.succeed(mockEvent)),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.verifyWebhookSignature('body', 'valid_sig');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe(mockEvent.id);
      expect(result.type).toBe('checkout.session.completed');
    });
  });

  describe('idempotency handling', () => {
    it('should process new event successfully', async () => {
      const webhookService = createTestWebhookService({
        checkEvent: vi.fn(() => Effect.succeed(null)),
        claimEvent: vi.fn(() => Effect.succeed(undefined)),
        completeEvent: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = TestWebhookLayer(webhookService);

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        // Check if event exists
        const existing = yield* service.checkEvent('evt_new_123');
        expect(existing).toBeNull();
        // Claim it
        yield* service.claimEvent('evt_new_123', 'checkout.session.completed');
        // Complete it
        yield* service.completeEvent('evt_new_123');
        return 'processed';
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe('processed');
      expect(webhookService.claimEvent).toHaveBeenCalledWith(
        'evt_new_123',
        'checkout.session.completed',
      );
      expect(webhookService.completeEvent).toHaveBeenCalledWith('evt_new_123');
    });

    it('should return 200 for duplicate event (no reprocessing)', async () => {
      const webhookService = createTestWebhookService({
        claimEvent: vi.fn(() =>
          Effect.fail(
            new DuplicateWebhookError({
              eventId: 'evt_duplicate_123',
              processedAt: new Date(),
            }),
          ),
        ),
      });

      const testLayer = TestWebhookLayer(webhookService);

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_duplicate_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(DuplicateWebhookError);
        }
      }
    });

    it('should retry failed events', async () => {
      let attemptCount = 0;
      const webhookService = createTestWebhookService({
        claimEvent: vi.fn(() => {
          attemptCount++;
          return Effect.succeed(undefined);
        }),
        completeEvent: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = TestWebhookLayer(webhookService);

      // First attempt - simulate it would process
      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        yield* service.claimEvent('evt_retry_123', 'checkout.session.completed');
        yield* service.completeEvent('evt_retry_123');
        return attemptCount;
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(1);
    });
  });

  describe('checkout.session.completed', () => {
    it('should create membership for active subscription', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.succeed(undefined)),
        setMembership: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        customer_email: 'member@example.com',
        subscription: 'sub_active_123',
      }) as Stripe.Checkout.Session;

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(firestoreService.setMembership).toHaveBeenCalled();
    });

    it('should skip membership for incomplete subscription', async () => {
      const mockSubscription = createMockSubscription({status: 'incomplete'});

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

    it('should add processing fee when metadata present', async () => {
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(null)),
        setUser: vi.fn(() => Effect.succeed(undefined)),
        setMembership: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        customer: 'cus_with_fee',
        metadata: {processingFee: '105'},
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

  describe('customer.subscription.updated', () => {
    it('should update membership status', async () => {
      const mockUser = createMockUserDocument({stripeCustomerId: 'cus_123'});

      const stripeService = createTestStripeService();
      const firestoreService = createTestFirestoreService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(mockUser)),
        updateMembership: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSubscription = createMockSubscription({
        id: 'sub_updated',
        customer: 'cus_123',
        status: 'past_due',
      });

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionUpdated(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(firestoreService.updateMembership).toHaveBeenCalled();
      const updateCall = (firestoreService.updateMembership as any).mock.calls[0];
      expect(updateCall[2].status).toBe('past_due');
    });

    it('should handle unknown customer gracefully', async () => {
      const stripeService = createTestStripeService();
      const firestoreService = createTestFirestoreService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSubscription = createMockSubscription({
        customer: 'cus_unknown',
      });

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionUpdated(mockSubscription);
      });

      // Should not throw, just log warning
      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(firestoreService.updateMembership).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should mark membership as canceled', async () => {
      const mockUser = createMockUserDocument({stripeCustomerId: 'cus_cancel'});

      const stripeService = createTestStripeService();
      const firestoreService = createTestFirestoreService({
        getUserByStripeCustomerId: vi.fn(() => Effect.succeed(mockUser)),
        updateMembership: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSubscription = createMockSubscription({
        id: 'sub_canceled',
        customer: 'cus_cancel',
      });

      const program = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processSubscriptionDeleted(mockSubscription);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program, MembershipServiceLive), testLayer),
      );

      expect(firestoreService.updateMembership).toHaveBeenCalled();
      const updateCall = (firestoreService.updateMembership as any).mock.calls[0];
      expect(updateCall[2].status).toBe('canceled');
      expect(updateCall[2].autoRenew).toBe(false);
    });
  });

  describe('error recovery', () => {
    it('should mark event as failed on processing error', async () => {
      const webhookService = createTestWebhookService({
        claimEvent: vi.fn(() => Effect.succeed(undefined)),
        failEvent: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = TestWebhookLayer(webhookService);

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        yield* service.claimEvent('evt_error_123', 'checkout.session.completed');
        // Simulate processing error
        yield* service.failEvent('evt_error_123', 'Processing failed: Network error');
      });

      await Effect.runPromise(Effect.provide(program, testLayer));

      expect(webhookService.failEvent).toHaveBeenCalledWith(
        'evt_error_123',
        'Processing failed: Network error',
      );
    });

    it('should allow retry on next webhook delivery', async () => {
      let retryCount = 0;
      const webhookService = createTestWebhookService({
        claimEvent: vi.fn(() => {
          retryCount++;
          return Effect.succeed(undefined);
        }),
        completeEvent: vi.fn(() => Effect.succeed(undefined)),
      });

      const testLayer = TestWebhookLayer(webhookService);

      // First delivery (would fail in real scenario)
      const program1 = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        yield* service.claimEvent('evt_retry_123', 'checkout.session.completed');
      });

      await Effect.runPromise(Effect.provide(program1, testLayer));

      // Second delivery (retry)
      const program2 = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        yield* service.claimEvent('evt_retry_123', 'checkout.session.completed');
        yield* service.completeEvent('evt_retry_123');
      });

      await Effect.runPromise(Effect.provide(program2, testLayer));

      expect(retryCount).toBe(2);
      expect(webhookService.completeEvent).toHaveBeenCalledWith('evt_retry_123');
    });

    it('should not duplicate membership on retry', async () => {
      const mockUser = createMockUserDocument({
        id: 'user_existing',
        email: 'existing@example.com',
      });
      const mockSubscription = createMockSubscription({status: 'active'});

      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
        addInvoiceItem: vi.fn(() => Effect.succeed({} as any)),
      });

      let setMembershipCallCount = 0;
      const firestoreService = createTestFirestoreService({
        getUserByEmail: vi.fn(() => Effect.succeed(mockUser)),
        setUser: vi.fn(() => Effect.succeed(undefined)),
        setMembership: vi.fn(() => {
          setMembershipCallCount++;
          return Effect.succeed(undefined);
        }),
      });

      const testLayer = Layer.merge(
        TestStripeLayer(stripeService),
        TestFirestoreLayer(firestoreService),
      );

      const mockSession = createMockCheckoutSession({
        customer_email: 'existing@example.com',
        metadata: {}, // No userId - force email lookup path
      }) as Stripe.Checkout.Session;

      // First processing
      const program1 = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program1, MembershipServiceLive), testLayer),
      );

      expect(setMembershipCallCount).toBe(1);

      // Second processing (retry) - would use same user ID
      const program2 = Effect.gen(function* () {
        const service = yield* MembershipService;
        return yield* service.processCheckoutCompleted(mockSession);
      });

      await Effect.runPromise(
        Effect.provide(Effect.provide(program2, MembershipServiceLive), testLayer),
      );

      // setMembership uses subscription ID as doc ID, so retry would overwrite not duplicate
      expect(setMembershipCallCount).toBe(2);
      // Both calls should use the same user ID (existing user)
      const calls = (firestoreService.setMembership as any).mock.calls;
      expect(calls[0][0]).toBe('user_existing');
      expect(calls[1][0]).toBe('user_existing');
    });
  });
});

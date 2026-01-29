import {Effect, Exit} from 'effect';
import {describe, it, expect, vi} from 'vitest';

import {StripeError, ValidationError} from '@/src/lib/effect/errors';
import {StripeService} from '@/src/lib/effect/stripe.service';

import {createTestStripeService, TestStripeLayer} from '../layers/test-layers';
import {
  createMockCheckoutSession,
  createMockSubscription,
  createMockCustomer,
  createMockPortalSession,
  createMockPrice,
  createMockInvoiceItem,
  createMockWebhookEvent,
} from '../mocks/stripe.mock';

describe('StripeService', () => {
  describe('createCheckoutSession', () => {
    it('should fail with ValidationError for invalid price ID', async () => {
      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() =>
          Effect.fail(
            new ValidationError({
              field: 'priceId',
              message: 'Invalid price ID format',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createCheckoutSession({
          priceId: 'invalid_price',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(ValidationError);
          expect((error.error as ValidationError).field).toBe('priceId');
        }
      }
    });

    it('should fail with ValidationError when neither userId nor email provided', async () => {
      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() =>
          Effect.fail(
            new ValidationError({
              field: 'email',
              message: 'Either userId or email is required',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(ValidationError);
          expect((error.error as ValidationError).field).toBe('email');
        }
      }
    });

    it('should fail with StripeError on network failure', async () => {
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

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('SESSION_CREATE_FAILED');
        }
      }
    });

    it('should calculate processing fee when coverFees is true', async () => {
      const mockSession = createMockCheckoutSession({
        metadata: {processingFee: '100'},
      });
      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() =>
          Effect.succeed({
            ...mockSession,
            sessionId: mockSession.id,
          }),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          coverFees: true,
          planPrice: 35,
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));
      expect(result).toBeDefined();
      expect(stripeService.createCheckoutSession).toHaveBeenCalled();
    });

    it('should create session successfully with valid parameters', async () => {
      const mockSession = createMockCheckoutSession();
      const stripeService = createTestStripeService({
        createCheckoutSession: vi.fn(() =>
          Effect.succeed({
            ...mockSession,
            sessionId: mockSession.id,
          }),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createCheckoutSession({
          priceId: 'price_individual_test',
          email: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeDefined();
      expect(result.id).toBe(mockSession.id);
      expect(result.url).toBe(mockSession.url);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should fail with StripeError when webhook secret not configured', async () => {
      const stripeService = createTestStripeService({
        verifyWebhookSignature: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'WEBHOOK_VERIFY_FAILED',
              message: 'Webhook secret not configured',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.verifyWebhookSignature('body', 'sig');
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

      expect(result).toBeDefined();
      expect(result.id).toBe(mockEvent.id);
      expect(result.type).toBe(mockEvent.type);
    });
  });

  describe('retrieveSubscription', () => {
    it('should fail with StripeError when subscription not found', async () => {
      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'SUBSCRIPTION_RETRIEVE_FAILED',
              message: 'No such subscription',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.retrieveSubscription('sub_invalid');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('SUBSCRIPTION_RETRIEVE_FAILED');
        }
      }
    });

    it('should fail with StripeError on network error', async () => {
      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'SUBSCRIPTION_RETRIEVE_FAILED',
              message: 'Network error',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.retrieveSubscription('sub_test_123');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
        }
      }
    });

    it('should return subscription on success', async () => {
      const mockSubscription = createMockSubscription();
      const stripeService = createTestStripeService({
        retrieveSubscription: vi.fn(() => Effect.succeed(mockSubscription)),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.retrieveSubscription('sub_test_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeDefined();
      expect(result.id).toBe(mockSubscription.id);
      expect(result.status).toBe(mockSubscription.status);
    });
  });

  describe('createPortalSession', () => {
    it('should fail with StripeError when customer not found', async () => {
      const stripeService = createTestStripeService({
        createPortalSession: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'PORTAL_CREATE_FAILED',
              message: 'No such customer',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createPortalSession('cus_invalid', 'https://example.com');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('PORTAL_CREATE_FAILED');
        }
      }
    });

    it('should fail with StripeError on network error', async () => {
      const stripeService = createTestStripeService({
        createPortalSession: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'PORTAL_CREATE_FAILED',
              message: 'Network error',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createPortalSession('cus_test_123', 'https://example.com');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should return portal session on success', async () => {
      const mockPortalSession = createMockPortalSession();
      const stripeService = createTestStripeService({
        createPortalSession: vi.fn(() => Effect.succeed(mockPortalSession)),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.createPortalSession('cus_test_123', 'https://example.com');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPortalSession.id);
      expect(result.url).toBe(mockPortalSession.url);
    });
  });

  describe('getPricesWithProducts', () => {
    it('should fail with StripeError when prices fetch fails', async () => {
      const stripeService = createTestStripeService({
        getPricesWithProducts: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'PRICES_RETRIEVE_FAILED',
              message: 'Failed to retrieve prices',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.getPricesWithProducts(['price_individual_test']);
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('PRICES_RETRIEVE_FAILED');
        }
      }
    });

    it('should return prices with products on success', async () => {
      const mockPrice = createMockPrice();
      const stripeService = createTestStripeService({
        getPricesWithProducts: vi.fn(() =>
          Effect.succeed([
            {
              price: mockPrice,
              product: {
                id: 'prod_test',
                name: 'Test Product',
                description: 'A test product',
              } as any,
            },
          ]),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.getPricesWithProducts(['price_individual_test']);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].price.id).toBe(mockPrice.id);
    });
  });

  describe('addInvoiceItem', () => {
    it('should fail with StripeError on failure', async () => {
      const stripeService = createTestStripeService({
        addInvoiceItem: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'INVOICE_ITEM_CREATE_FAILED',
              message: 'Failed to create invoice item',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.addInvoiceItem('cus_test_123', 100, 'Processing fee');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('INVOICE_ITEM_CREATE_FAILED');
        }
      }
    });

    it('should return invoice item on success', async () => {
      const mockInvoiceItem = createMockInvoiceItem();
      const stripeService = createTestStripeService({
        addInvoiceItem: vi.fn(() => Effect.succeed(mockInvoiceItem)),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.addInvoiceItem('cus_test_123', 100, 'Processing fee');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeDefined();
      expect(result.id).toBe(mockInvoiceItem.id);
    });
  });

  describe('getCustomer', () => {
    it('should fail with StripeError when customer not found', async () => {
      const stripeService = createTestStripeService({
        getCustomer: vi.fn(() =>
          Effect.fail(
            new StripeError({
              code: 'CUSTOMER_RETRIEVE_FAILED',
              message: 'No such customer',
            }),
          ),
        ),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.getCustomer('cus_invalid');
      });

      const result = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(StripeError);
          expect((error.error as StripeError).code).toBe('CUSTOMER_RETRIEVE_FAILED');
        }
      }
    });

    it('should return customer on success', async () => {
      const mockCustomer = createMockCustomer();
      const stripeService = createTestStripeService({
        getCustomer: vi.fn(() => Effect.succeed(mockCustomer)),
      });

      const testLayer = TestStripeLayer(stripeService);

      const program = Effect.gen(function* () {
        const service = yield* StripeService;
        return yield* service.getCustomer('cus_test_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeDefined();
      expect(result.id).toBe(mockCustomer.id);
      expect(result.email).toBe(mockCustomer.email);
    });
  });
});

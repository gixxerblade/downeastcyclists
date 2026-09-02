import {Effect} from 'effect';
import type Stripe from 'stripe';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {StripeService, StripeServiceLive} from '@/src/lib/effect/stripe.service';

import {createMockCheckoutSession} from '../mocks/stripe.mock';

const stripeMocks = vi.hoisted(() => ({
  createCheckoutSession:
    vi.fn<(params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Checkout.Session>>(),
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: stripeMocks.createCheckoutSession,
      },
    };
  },
}));

describe('Stripe checkout customer selection', () => {
  beforeEach(() => {
    stripeMocks.createCheckoutSession.mockResolvedValue(createMockCheckoutSession());
  });

  it('uses the existing customer without also sending customer_email', async () => {
    const program = Effect.gen(function* () {
      const stripe = yield* StripeService;
      return yield* stripe.createCheckoutSession({
        priceId: 'price_individual_test',
        userId: 'user_123',
        email: 'member@example.com',
        stripeCustomerId: 'cus_existing',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });
    });

    await Effect.runPromise(program.pipe(Effect.provide(StripeServiceLive)));

    const sessionConfig = stripeMocks.createCheckoutSession.mock.calls[0]?.[0];
    expect(sessionConfig).toBeDefined();
    expect(sessionConfig).toHaveProperty('customer', 'cus_existing');
    expect(sessionConfig).not.toHaveProperty('customer_email');
  });

  it('uses customer_email when there is no existing customer', async () => {
    const program = Effect.gen(function* () {
      const stripe = yield* StripeService;
      return yield* stripe.createCheckoutSession({
        priceId: 'price_individual_test',
        email: 'new-member@example.com',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });
    });

    await Effect.runPromise(program.pipe(Effect.provide(StripeServiceLive)));

    const sessionConfig = stripeMocks.createCheckoutSession.mock.calls[0]?.[0];
    expect(sessionConfig).toBeDefined();
    expect(sessionConfig).toHaveProperty('customer_email', 'new-member@example.com');
    expect(sessionConfig).not.toHaveProperty('customer');
  });
});

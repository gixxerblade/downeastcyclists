import type Stripe from 'stripe';
import {vi} from 'vitest';

export const createMockStripe = () => ({
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
  customers: {
    retrieve: vi.fn(),
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  prices: {
    retrieve: vi.fn(),
  },
  invoiceItems: {
    create: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
});

// Error factories
export const createStripeError = (
  type: 'card_error' | 'invalid_request_error' | 'api_error',
  code: string,
  message: string,
): Stripe.errors.StripeError => {
  const error = new Error(message) as unknown as Stripe.errors.StripeError;
  Object.defineProperty(error, 'type', {value: type, writable: false});
  Object.defineProperty(error, 'code', {value: code, writable: false});
  return error;
};

export const cardDeclinedError = () =>
  createStripeError('card_error', 'card_declined', 'Your card was declined.');

export const insufficientFundsError = () =>
  createStripeError('card_error', 'insufficient_funds', 'Insufficient funds.');

export const invalidSignatureError = () =>
  createStripeError(
    'invalid_request_error',
    'webhook_signature_verification_failed',
    'Invalid signature',
  );

export const stripeNetworkError = () =>
  createStripeError('api_error', 'api_connection_error', 'Network error');

// Mock data factories
export const createMockCheckoutSession = (
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session =>
  ({
    id: 'cs_test_123',
    object: 'checkout.session',
    url: 'https://checkout.stripe.com/test',
    customer: 'cus_test_123',
    customer_email: 'test@example.com',
    subscription: 'sub_test_123',
    mode: 'subscription',
    status: 'complete',
    metadata: {
      userId: 'user_123',
      processingFee: '0',
    },
    ...overrides,
  }) as Stripe.Checkout.Session;

export const createMockSubscription = (
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription =>
  ({
    id: 'sub_test_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_test_123',
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: 'si_test_123',
          price: {
            id: 'price_individual_test',
            product: 'prod_test_123',
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        },
      ],
    },
    ...overrides,
  }) as Stripe.Subscription;

export const createMockCustomer = (overrides: Partial<Stripe.Customer> = {}): Stripe.Customer =>
  ({
    id: 'cus_test_123',
    object: 'customer',
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  }) as Stripe.Customer;

export const createMockPortalSession = (
  overrides: Partial<Stripe.BillingPortal.Session> = {},
): Stripe.BillingPortal.Session =>
  ({
    id: 'bps_test_123',
    object: 'billing_portal.session',
    url: 'https://billing.stripe.com/test',
    customer: 'cus_test_123',
    ...overrides,
  }) as Stripe.BillingPortal.Session;

export const createMockPrice = (overrides: Partial<Stripe.Price> = {}): Stripe.Price =>
  ({
    id: 'price_individual_test',
    object: 'price',
    unit_amount: 3500,
    currency: 'usd',
    product: {
      id: 'prod_test_123',
      name: 'Individual Membership',
    },
    ...overrides,
  }) as Stripe.Price;

export const createMockInvoiceItem = (
  overrides: Partial<Stripe.InvoiceItem> = {},
): Stripe.InvoiceItem =>
  ({
    id: 'ii_test_123',
    object: 'invoiceitem',
    amount: 100,
    customer: 'cus_test_123',
    description: 'Processing fee',
    ...overrides,
  }) as Stripe.InvoiceItem;

export const createMockWebhookEvent = (
  type: string,
  data: object,
  overrides: Partial<Stripe.Event> = {},
): Stripe.Event =>
  ({
    id: 'evt_test_123',
    object: 'event',
    type,
    data: {
      object: data,
    },
    ...overrides,
  }) as Stripe.Event;

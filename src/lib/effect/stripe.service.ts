import { Context, Effect, Layer } from "effect";
import type { Schema as S } from "@effect/schema";
import Stripe from "stripe";
import { StripeError, ValidationError } from "./errors";
import type { CheckoutSessionRequest } from "./schemas";

// Service interface
export interface StripeService {
  readonly createCheckoutSession: (
    params: S.Schema.Type<typeof CheckoutSessionRequest>
  ) => Effect.Effect<Stripe.Checkout.Session, StripeError | ValidationError>;

  readonly retrieveSubscription: (
    subscriptionId: string
  ) => Effect.Effect<Stripe.Subscription, StripeError>;

  readonly verifyWebhookSignature: (
    body: string,
    signature: string
  ) => Effect.Effect<Stripe.Event, StripeError>;

  readonly getCustomer: (
    customerId: string
  ) => Effect.Effect<Stripe.Customer, StripeError>;
}

// Service tag
export const StripeService = Context.GenericTag<StripeService>("StripeService");

// Valid price IDs - loaded from environment variables
const VALID_PRICE_IDS = [
  process.env.STRIPE_PRICE_INDIVIDUAL,
  process.env.STRIPE_PRICE_FAMILY,
].filter(Boolean) as string[];

// Create Stripe client lazily
const createStripeClient = (): { stripe: Stripe; webhookSecret: string | undefined } => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }

  const stripe = new Stripe(secretKey);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  return { stripe, webhookSecret };
};

// Implementation
const make = Effect.sync(() => {
  let client: { stripe: Stripe; webhookSecret: string | undefined } | null = null;

  const getClient = () => {
    if (!client) {
      client = createStripeClient();
    }
    return client;
  };

  return StripeService.of({
    createCheckoutSession: (params) => {
      // Validate price ID
      if (!VALID_PRICE_IDS.includes(params.priceId)) {
        return Effect.fail(
          new ValidationError({
            field: "priceId",
            message: "Invalid price ID",
          })
        );
      }

      // Validate email or userId present
      if (!params.userId && !params.email) {
        return Effect.fail(
          new ValidationError({
            field: "email",
            message: "Either userId or email is required",
          })
        );
      }

      return Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: params.priceId, quantity: 1 }],
            customer_email: params.email,
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: { userId: params.userId || "" },
            subscription_data: {
              metadata: { userId: params.userId || "" },
            },
          });
          return session;
        },
        catch: (error) =>
          new StripeError({
            code: "SESSION_CREATE_FAILED",
            message: "Failed to create checkout session",
            cause: error,
          }),
      });
    },

    retrieveSubscription: (subscriptionId) =>
      Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();
          return stripe.subscriptions.retrieve(subscriptionId);
        },
        catch: (error) =>
          new StripeError({
            code: "SUBSCRIPTION_RETRIEVE_FAILED",
            message: `Failed to retrieve subscription ${subscriptionId}`,
            cause: error,
          }),
      }),

    verifyWebhookSignature: (body, signature) =>
      Effect.try({
        try: () => {
          const { stripe, webhookSecret } = getClient();
          if (!webhookSecret) {
            throw new Error("STRIPE_WEBHOOK_SECRET not configured");
          }
          return stripe.webhooks.constructEvent(body, signature, webhookSecret);
        },
        catch: (error) =>
          new StripeError({
            code: "WEBHOOK_VERIFY_FAILED",
            message: "Failed to verify webhook signature",
            cause: error,
          }),
      }),

    getCustomer: (customerId) =>
      Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();
          return stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>;
        },
        catch: (error) =>
          new StripeError({
            code: "CUSTOMER_RETRIEVE_FAILED",
            message: `Failed to retrieve customer ${customerId}`,
            cause: error,
          }),
      }),
  });
});

// Live layer
export const StripeServiceLive = Layer.effect(StripeService, make);

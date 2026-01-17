import { Context, Effect, Layer } from "effect";
import type { Schema as S } from "@effect/schema";
import Stripe from "stripe";
import { StripeError, ValidationError } from "./errors";
import type { CheckoutSessionRequest } from "./schemas";

// Service interface
export interface StripeService {
  readonly createCheckoutSession: (
    params: S.Schema.Type<typeof CheckoutSessionRequest>,
  ) => Effect.Effect<Stripe.Checkout.Session, StripeError | ValidationError>;

  readonly retrieveSubscription: (
    subscriptionId: string,
  ) => Effect.Effect<Stripe.Subscription, StripeError>;

  readonly verifyWebhookSignature: (
    body: string,
    signature: string,
  ) => Effect.Effect<Stripe.Event, StripeError>;

  readonly getCustomer: (customerId: string) => Effect.Effect<Stripe.Customer, StripeError>;

  readonly createPortalSession: (
    customerId: string,
    returnUrl: string,
  ) => Effect.Effect<Stripe.BillingPortal.Session, StripeError>;

  readonly getPricesWithProducts: (
    priceIds: string[],
  ) => Effect.Effect<Array<{ price: Stripe.Price; product: Stripe.Product }>, StripeError>;

  readonly addInvoiceItem: (
    customerId: string,
    amount: number,
    description: string,
  ) => Effect.Effect<Stripe.InvoiceItem, StripeError>;
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
          }),
        );
      }

      // Validate email or userId present
      if (!params.userId && !params.email) {
        return Effect.fail(
          new ValidationError({
            field: "email",
            message: "Either userId or email is required",
          }),
        );
      }

      return Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();

          // Calculate processing fee if user opted in and store in metadata
          const processingFee =
            params.coverFees && params.planPrice
              ? Math.round((params.planPrice * 0.027 + 0.05) * 100) // Convert to cents
              : 0;

          // Base session config
          const sessionConfig: any = {
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: params.priceId, quantity: 1 }],
            customer_email: params.email,
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: {
              userId: params.userId || "",
              processingFee: processingFee.toString(),
            },
            subscription_data: {
              metadata: {
                userId: params.userId || "",
                processingFee: processingFee.toString(),
              },
            },
          };

          const session = await stripe.checkout.sessions.create(sessionConfig);
          return session;
        },
        catch: (error) => {
          // Log the actual Stripe error for debugging
          console.error("Stripe checkout session creation failed:", error);
          return new StripeError({
            code: "SESSION_CREATE_FAILED",
            message: error instanceof Error ? error.message : "Failed to create checkout session",
            cause: error,
          });
        },
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

    createPortalSession: (customerId, returnUrl) =>
      Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();
          return stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
          });
        },
        catch: (error) =>
          new StripeError({
            code: "PORTAL_CREATE_FAILED",
            message: "Failed to create customer portal session",
            cause: error,
          }),
      }),

    getPricesWithProducts: (priceIds) =>
      Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();

          // Fetch all prices in parallel
          const pricePromises = priceIds.map((id) =>
            stripe.prices.retrieve(id, { expand: ["product"] }),
          );

          const prices = await Promise.all(pricePromises);

          // Map to price + product pairs
          return prices.map((price) => ({
            price,
            product: price.product as Stripe.Product,
          }));
        },
        catch: (error) =>
          new StripeError({
            code: "PRICES_RETRIEVE_FAILED",
            message: "Failed to retrieve prices from Stripe",
            cause: error,
          }),
      }),

    addInvoiceItem: (customerId, amount, description) =>
      Effect.tryPromise({
        try: async () => {
          const { stripe } = getClient();
          return stripe.invoiceItems.create({
            customer: customerId,
            amount,
            currency: "usd",
            description,
          });
        },
        catch: (error) =>
          new StripeError({
            code: "INVOICE_ITEM_CREATE_FAILED",
            message: "Failed to add invoice item",
            cause: error,
          }),
      }),
  });
});

// Live layer
export const StripeServiceLive = Layer.effect(StripeService, make);

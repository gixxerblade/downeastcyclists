import { Context, Effect, Layer, pipe } from "effect";
import type { Schema as S } from "@effect/schema";
import type Stripe from "stripe";
import { Timestamp } from "@google-cloud/firestore";
import { StripeService } from "./stripe.service";
import { FirestoreService } from "./firestore.service";
import {
  StripeError,
  FirestoreError,
  ValidationError,
  NotFoundError,
} from "./errors";
import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  MembershipStatusResponse,
  MembershipStatus,
} from "./schemas";

// Price ID to plan type mapping - loaded from environment variables
const PRICE_TO_PLAN: Record<string, "individual" | "family"> = {
  [process.env.STRIPE_PRICE_INDIVIDUAL || ""]: "individual",
  [process.env.STRIPE_PRICE_FAMILY || ""]: "family",
};

// Service interface
export interface MembershipService {
  readonly createCheckoutSession: (
    request: S.Schema.Type<typeof CheckoutSessionRequest>
  ) => Effect.Effect<
    S.Schema.Type<typeof CheckoutSessionResponse>,
    StripeError | FirestoreError | ValidationError
  >;

  readonly processCheckoutCompleted: (
    session: Stripe.Checkout.Session
  ) => Effect.Effect<void, StripeError | FirestoreError>;

  readonly processSubscriptionUpdated: (
    subscription: Stripe.Subscription
  ) => Effect.Effect<void, FirestoreError>;

  readonly processSubscriptionDeleted: (
    subscription: Stripe.Subscription
  ) => Effect.Effect<void, FirestoreError>;

  readonly getMembershipStatus: (
    userId: string
  ) => Effect.Effect<
    S.Schema.Type<typeof MembershipStatusResponse>,
    FirestoreError | NotFoundError
  >;

  readonly getPlans: () => Effect.Effect<
    Array<{ id: string; name: string; price: number; benefits: string[] }>,
    FirestoreError
  >;
}

// Service tag
export const MembershipService =
  Context.GenericTag<MembershipService>("MembershipService");

// Implementation - depends on StripeService and FirestoreService
const make = Effect.gen(function* () {
  const stripe = yield* StripeService;
  const firestore = yield* FirestoreService;

  return MembershipService.of({
    // Checkout flow: validate → lookup user → create session
    createCheckoutSession: (request) =>
      pipe(
        // Step 1: Validate request using Effect Schema
        Effect.succeed(request),
        Effect.tap(() =>
          Effect.log(`Creating checkout session for ${request.email || request.userId}`)
        ),

        // Step 2: Look up existing user if userId provided
        Effect.flatMap((req) =>
          req.userId
            ? pipe(
                firestore.getUser(req.userId),
                Effect.map((user) => ({
                  ...req,
                  stripeCustomerId: user?.stripeCustomerId,
                  customerEmail: user?.email || req.email,
                }))
              )
            : Effect.succeed({
                ...req,
                stripeCustomerId: undefined,
                customerEmail: req.email,
              })
        ),

        // Step 3: Create Stripe checkout session
        Effect.flatMap((enrichedRequest) =>
          stripe.createCheckoutSession({
            priceId: enrichedRequest.priceId,
            userId: enrichedRequest.userId,
            email: enrichedRequest.customerEmail,
            successUrl: enrichedRequest.successUrl,
            cancelUrl: enrichedRequest.cancelUrl,
          })
        ),

        // Step 4: Transform to response
        Effect.map((session) => ({
          sessionId: session.id,
          url: session.url!,
        })),

        Effect.tap((response) =>
          Effect.log(`Checkout session created: ${response.sessionId}`)
        )
      ),

    // Webhook: checkout.session.completed
    processCheckoutCompleted: (session) =>
      Effect.gen(function* () {
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const customerEmail =
          session.customer_email || session.customer_details?.email;
        const userId = session.metadata?.userId;

        yield* Effect.log(
          `Processing checkout completed for ${customerEmail}, subscription ${subscriptionId}`
        );

        // Retrieve subscription details
        const subscription = yield* stripe.retrieveSubscription(subscriptionId);

        const priceId = subscription.items.data[0]?.price.id;
        const planType = PRICE_TO_PLAN[priceId] || "individual";

        // Extract period dates from the subscription items
        const subscriptionItem = subscription.items.data[0];
        const currentPeriodStart = (subscriptionItem as any).current_period_start;
        const currentPeriodEnd = (subscriptionItem as any).current_period_end;

        yield* Effect.log(`Subscription dates - start: ${currentPeriodStart}, end: ${currentPeriodEnd}`);

        if (!currentPeriodStart || !currentPeriodEnd) {
          return yield* Effect.fail(
            new StripeError({
              code: "INVALID_SUBSCRIPTION_DATA",
              message: "Missing subscription period dates"
            })
          );
        }

        // Find or create user
        let userDocId = userId;
        if (!userDocId) {
          const existingUser = customerEmail
            ? yield* firestore.getUserByEmail(customerEmail)
            : null;
          userDocId = existingUser?.id || subscriptionId; // Use subscription ID as fallback
        }

        // Update user document
        yield* firestore.setUser(userDocId, {
          id: userDocId,
          email: customerEmail || "",
          stripeCustomerId: customerId,
          createdAt: Timestamp.now(),
        } as any);

        // Create membership document with proper Firestore Timestamps
        yield* firestore.setMembership(userDocId, subscriptionId, {
          stripeSubscriptionId: subscriptionId,
          planType,
          status: subscription.status as MembershipStatus,
          startDate: Timestamp.fromDate(new Date(currentPeriodStart * 1000)),
          endDate: Timestamp.fromDate(new Date(currentPeriodEnd * 1000)),
          autoRenew: !subscription.cancel_at_period_end,
        } as any);

        yield* Effect.log(
          `Membership created: ${subscriptionId} for user ${userDocId}, plan: ${planType}`
        );
      }),

    // Webhook: customer.subscription.updated
    processSubscriptionUpdated: (subscription) =>
      Effect.gen(function* () {
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;

        yield* Effect.log(`Processing subscription update: ${subscriptionId}`);

        // Find user by Stripe customer ID
        const user = yield* firestore.getUserByStripeCustomerId(customerId);
        if (!user) {
          yield* Effect.logWarning(`No user found for customer ${customerId}`);
          return;
        }

        // Update membership - extract period dates from subscription items
        const subscriptionItem = subscription.items.data[0];
        const currentPeriodStart = (subscriptionItem as any).current_period_start;
        const currentPeriodEnd = (subscriptionItem as any).current_period_end;

        yield* firestore.updateMembership(user.id, subscriptionId, {
          status: subscription.status as MembershipStatus,
          startDate: Timestamp.fromDate(new Date(currentPeriodStart * 1000)),
          endDate: Timestamp.fromDate(new Date(currentPeriodEnd * 1000)),
          autoRenew: !subscription.cancel_at_period_end,
        } as any);

        yield* Effect.log(`Membership updated: ${subscriptionId}`);
      }),

    // Webhook: customer.subscription.deleted
    processSubscriptionDeleted: (subscription) =>
      Effect.gen(function* () {
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;

        yield* Effect.log(`Processing subscription deletion: ${subscriptionId}`);

        const user = yield* firestore.getUserByStripeCustomerId(customerId);
        if (!user) {
          yield* Effect.logWarning(`No user found for customer ${customerId}`);
          return;
        }

        yield* firestore.updateMembership(user.id, subscriptionId, {
          status: "canceled",
          autoRenew: false,
        });

        yield* Effect.log(`Membership canceled: ${subscriptionId}`);
      }),

    // Get membership status for user
    getMembershipStatus: (userId) =>
      Effect.gen(function* () {
        const user = yield* firestore.getUser(userId);

        if (!user) {
          return yield* Effect.fail(
            new NotFoundError({ resource: "user", id: userId })
          );
        }

        const membership = yield* firestore.getActiveMembership(userId);

        let membershipData: S.Schema.Type<typeof MembershipStatusResponse>["membership"] = null;

        if (membership) {
          const plan = yield* firestore.getPlan(membership.planType);
          const planName =
            plan?.name ||
            (membership.planType === "family"
              ? "Family Annual Membership"
              : "Individual Annual Membership");

          membershipData = {
            planType: membership.planType,
            planName,
            status: membership.status,
            endDate: membership.endDate.toDate?.()?.toISOString() ||
              new Date(membership.endDate as unknown as number).toISOString(),
            autoRenew: membership.autoRenew,
          };
        }

        return {
          userId,
          email: user.email,
          isActive:
            membershipData?.status === "active" ||
            membershipData?.status === "trialing",
          membership: membershipData,
        };
      }),

    // Get available plans
    getPlans: () =>
      pipe(
        firestore.getPlans(),
        Effect.map((plans) =>
          plans.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            benefits: [...p.benefits],
          }))
        )
      ),
  });
});

// Live layer - requires StripeService and FirestoreService
export const MembershipServiceLive = Layer.effect(MembershipService, make);

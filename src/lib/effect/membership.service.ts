import type {Schema as S} from '@effect/schema';
import {Timestamp} from '@google-cloud/firestore';
import {Context, Effect, Layer, pipe} from 'effect';
import type Stripe from 'stripe';

import {hasActiveMembershipAccess} from '../membership-access';
import {
  getBenefitsForPriceId,
  getConfiguredPriceIds,
  getPlanNameForType,
} from '../membership-plans-config';

import {StripeError, FirestoreError, ValidationError, NotFoundError} from './errors';
import {FirestoreService} from './firestore.service';
import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  MembershipStatusResponse,
  MembershipStatus,
} from './schemas';
import {StripeService} from './stripe.service';

// Price ID to plan type mapping - loaded from environment variables
const PRICE_TO_PLAN: Record<string, 'individual' | 'family'> = {
  [process.env.STRIPE_PRICE_INDIVIDUAL || '']: 'individual',
  [process.env.STRIPE_PRICE_FAMILY || '']: 'family',
};

// Service interface
export interface MembershipService {
  readonly createCheckoutSession: (
    request: S.Schema.Type<typeof CheckoutSessionRequest>,
  ) => Effect.Effect<
    S.Schema.Type<typeof CheckoutSessionResponse>,
    StripeError | FirestoreError | ValidationError
  >;

  readonly processCheckoutCompleted: (
    session: Stripe.Checkout.Session,
  ) => Effect.Effect<void, StripeError | FirestoreError>;

  readonly processSubscriptionUpdated: (
    subscription: Stripe.Subscription,
  ) => Effect.Effect<void, FirestoreError>;

  readonly processSubscriptionDeleted: (
    subscription: Stripe.Subscription,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getMembershipStatus: (
    userId: string,
  ) => Effect.Effect<
    S.Schema.Type<typeof MembershipStatusResponse>,
    FirestoreError | NotFoundError
  >;

  readonly getPlans: () => Effect.Effect<
    Array<{id: string; name: string; price: number; benefits: string[]; stripePriceId: string}>,
    StripeError
  >;
}

// Service tag
export const MembershipService = Context.GenericTag<MembershipService>('MembershipService');

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
          Effect.log(`Creating checkout session for ${request.email || request.userId}`),
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
                })),
              )
            : Effect.succeed({
                ...req,
                stripeCustomerId: undefined,
                customerEmail: req.email,
              }),
        ),

        // Step 3: Create Stripe checkout session
        Effect.flatMap((enrichedRequest) =>
          stripe.createCheckoutSession({
            priceId: enrichedRequest.priceId,
            userId: enrichedRequest.userId,
            email: enrichedRequest.customerEmail,
            successUrl: enrichedRequest.successUrl,
            cancelUrl: enrichedRequest.cancelUrl,
            coverFees: enrichedRequest.coverFees,
            planPrice: enrichedRequest.planPrice,
          }),
        ),

        // Step 4: Transform to response
        Effect.flatMap((session) => {
          if (!session.url) {
            return Effect.fail(
              new StripeError({
                code: 'CHECKOUT_SESSION_NO_URL',
                message: 'Checkout session was created but has no URL',
              }),
            );
          }
          return Effect.succeed({
            sessionId: session.id,
            url: session.url,
          });
        }),

        Effect.tap((response) => Effect.log(`Checkout session created: ${response.sessionId}`)),
      ),

    // Webhook: checkout.session.completed
    processCheckoutCompleted: (session) =>
      Effect.gen(function* () {
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const userId = session.metadata?.userId;
        const processingFee = session.metadata?.processingFee;

        yield* Effect.log(
          `Processing checkout completed for ${customerEmail}, subscription ${subscriptionId}`,
        );

        // Add processing fee as invoice item if present
        if (processingFee && parseInt(processingFee) > 0) {
          yield* Effect.log(
            `Adding processing fee invoice item: $${parseInt(processingFee) / 100}`,
          );
          yield* stripe.addInvoiceItem(
            customerId,
            parseInt(processingFee),
            'Credit Card Processing Fee (Optional)',
          );
        }

        // Retrieve subscription details
        const subscription = yield* stripe.retrieveSubscription(subscriptionId);

        // IMPORTANT: Only create membership for active subscriptions
        // If status is 'incomplete', payment failed - don't create membership
        if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
          yield* Effect.log(
            `Skipping membership creation - subscription ${subscriptionId} has status: ${subscription.status}`,
          );
          return;
        }

        const priceId = subscription.items.data[0]?.price.id;
        const planType = PRICE_TO_PLAN[priceId] || 'individual';

        // Extract period dates from the subscription items
        const subscriptionItem = subscription.items.data[0];
        const currentPeriodStart = (subscriptionItem as any).current_period_start;
        const currentPeriodEnd = (subscriptionItem as any).current_period_end;

        yield* Effect.log(
          `Subscription dates - start: ${currentPeriodStart}, end: ${currentPeriodEnd}`,
        );

        if (!currentPeriodStart || !currentPeriodEnd) {
          return yield* Effect.fail(
            new StripeError({
              code: 'INVALID_SUBSCRIPTION_DATA',
              message: 'Missing subscription period dates',
            }),
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
          email: customerEmail || '',
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
          `Membership created: ${subscriptionId} for user ${userDocId}, plan: ${planType}`,
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
          status: 'canceled',
          autoRenew: false,
        });

        yield* Effect.log(`Membership canceled: ${subscriptionId}`);
      }),

    // Get membership status for user
    getMembershipStatus: (userId) =>
      Effect.gen(function* () {
        const user = yield* firestore.getUser(userId);

        if (!user) {
          return yield* Effect.fail(new NotFoundError({resource: 'user', id: userId}));
        }

        const membership = yield* firestore.getActiveMembership(userId);

        let membershipData: S.Schema.Type<typeof MembershipStatusResponse>['membership'] = null;

        if (membership) {
          const planName = getPlanNameForType(membership.planType);

          membershipData = {
            planType: membership.planType,
            planName,
            status: membership.status,
            endDate:
              membership.endDate.toDate?.()?.toISOString() ||
              new Date(membership.endDate as unknown as number).toISOString(),
            autoRenew: membership.autoRenew,
          };
        }

        return {
          userId,
          email: user.email,
          isActive: hasActiveMembershipAccess(membershipData?.status ?? null),
          membership: membershipData,
        };
      }),

    // Get available plans from Stripe
    getPlans: () =>
      pipe(
        // Get configured price IDs from env
        Effect.succeed(getConfiguredPriceIds()),

        // Fetch prices with products from Stripe
        Effect.flatMap((priceIds) => stripe.getPricesWithProducts(priceIds)),

        // Map to plan format with benefits from config
        Effect.map((pricesWithProducts) =>
          pricesWithProducts.map(({price, product}) => ({
            id: price.id,
            name: product.name,
            price: price.unit_amount ? price.unit_amount / 100 : 0, // Convert cents to dollars
            benefits: getBenefitsForPriceId(price.id),
            stripePriceId: price.id,
          })),
        ),
      ),
  });
});

// Live layer - requires StripeService and FirestoreService
export const MembershipServiceLive = Layer.effect(MembershipService, make);

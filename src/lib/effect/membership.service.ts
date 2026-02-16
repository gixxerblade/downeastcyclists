import type {Schema as S} from 'effect';
import {Context, Effect, Layer, pipe} from 'effect';
import type Stripe from 'stripe';

import {hasActiveMembershipAccess} from '../membership-access';
import {
  getBenefitsForPriceId,
  getConfiguredPriceIds,
  getPlanNameForType,
} from '../membership-plans-config';

import {DatabaseService} from './database.service';
import {StripeError, DatabaseError, ValidationError, NotFoundError} from './errors';
import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  MembershipStatusResponse,
  MembershipStatus,
} from './schemas';
import {StripeService} from './stripe.service';

// Price ID to plan type mapping - loaded from environment variables
// Validates that required price IDs are configured
const getPriceToPlanMapping = (): Record<string, 'individual' | 'family'> => {
  const individualPriceId = process.env.STRIPE_PRICE_INDIVIDUAL;
  const familyPriceId = process.env.STRIPE_PRICE_FAMILY;

  const mapping: Record<string, 'individual' | 'family'> = {};

  if (individualPriceId) {
    mapping[individualPriceId] = 'individual';
  }

  if (familyPriceId) {
    mapping[familyPriceId] = 'family';
  }

  return mapping;
};

const PRICE_TO_PLAN = getPriceToPlanMapping();

// Service interface
export interface MembershipService {
  readonly createCheckoutSession: (
    request: S.Schema.Type<typeof CheckoutSessionRequest>,
  ) => Effect.Effect<
    S.Schema.Type<typeof CheckoutSessionResponse>,
    StripeError | DatabaseError | ValidationError
  >;

  readonly processCheckoutCompleted: (
    session: Stripe.Checkout.Session,
  ) => Effect.Effect<void, StripeError | DatabaseError>;

  readonly processSubscriptionUpdated: (
    subscription: Stripe.Subscription,
  ) => Effect.Effect<void, DatabaseError>;

  readonly processSubscriptionDeleted: (
    subscription: Stripe.Subscription,
  ) => Effect.Effect<void, DatabaseError>;

  readonly getMembershipStatus: (
    userId: string,
  ) => Effect.Effect<S.Schema.Type<typeof MembershipStatusResponse>, DatabaseError | NotFoundError>;

  readonly getPlans: () => Effect.Effect<
    Array<{id: string; name: string; price: number; benefits: string[]; stripePriceId: string}>,
    StripeError
  >;
}

// Service tag
export const MembershipService = Context.GenericTag<MembershipService>('MembershipService');

// Implementation - depends on StripeService and DatabaseService
const make = Effect.gen(function* () {
  const stripe = yield* StripeService;
  const db = yield* DatabaseService;

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
                db.getUser(req.userId),
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
          return yield* new StripeError({
            code: 'INVALID_SUBSCRIPTION_DATA',
            message: 'Missing subscription period dates',
          });
        }

        // Find or create user
        // If no Firebase UID is provided (guest checkout), we:
        // 1. Check if a user exists with this email
        // 2. Fall back to using subscriptionId as the document ID
        let userDocId = userId;
        if (!userDocId) {
          const existingUser = customerEmail ? yield* db.getUserByEmail(customerEmail) : null;
          userDocId = existingUser?.id || subscriptionId;
        }

        // Update user document with ISO date strings
        yield* db.setUser(userDocId, {
          id: userDocId,
          email: customerEmail || '',
          stripeCustomerId: customerId,
          createdAt: new Date().toISOString(),
        } as any);

        // Create membership document with proper date handling
        yield* db.setMembership(userDocId, subscriptionId, {
          stripeSubscriptionId: subscriptionId,
          planType,
          status: subscription.status as MembershipStatus,
          startDate: new Date(currentPeriodStart * 1000).toISOString(),
          endDate: new Date(currentPeriodEnd * 1000).toISOString(),
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
        const user = yield* db.getUserByStripeCustomerId(customerId);
        if (!user) {
          yield* Effect.logWarning(`No user found for customer ${customerId}`);
          return;
        }

        // Update membership - extract period dates from subscription items
        const subscriptionItem = subscription.items.data[0];
        const currentPeriodStart = (subscriptionItem as any).current_period_start;
        const currentPeriodEnd = (subscriptionItem as any).current_period_end;

        yield* db.updateMembership(user.id, subscriptionId, {
          status: subscription.status as MembershipStatus,
          startDate: new Date(currentPeriodStart * 1000).toISOString(),
          endDate: new Date(currentPeriodEnd * 1000).toISOString(),
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

        const user = yield* db.getUserByStripeCustomerId(customerId);
        if (!user) {
          yield* Effect.logWarning(`No user found for customer ${customerId}`);
          return;
        }

        yield* db.updateMembership(user.id, subscriptionId, {
          status: 'canceled',
          autoRenew: false,
        });

        yield* Effect.log(`Membership canceled: ${subscriptionId}`);
      }),

    // Get membership status for user
    getMembershipStatus: (userId) =>
      Effect.gen(function* () {
        const user = yield* db.getUser(userId);

        if (!user) {
          return yield* new NotFoundError({resource: 'user', id: userId});
        }

        const membership = yield* db.getActiveMembership(userId);

        let membershipData: S.Schema.Type<typeof MembershipStatusResponse>['membership'] = null;

        if (membership) {
          const planName = getPlanNameForType(membership.planType);

          membershipData = {
            planType: membership.planType,
            planName,
            status: membership.status,
            endDate: new Date(membership.endDate as string).toISOString(),
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

// Live layer - requires StripeService and DatabaseService
export const MembershipServiceLive = Layer.effect(MembershipService, make);

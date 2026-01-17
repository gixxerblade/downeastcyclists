# Plan: Stripe Membership Edge Cases & Resilience

## Task Description

Implement comprehensive edge case handling for the Stripe membership system to ensure data consistency between Stripe and Firestore, handle payment scenarios correctly, and provide a robust member experience across all subscription lifecycle scenarios.

## Objective

Create a resilient membership system that:

- Handles webhook delivery issues (duplicates, out-of-order, missing)
- Correctly handles payment failures (both initial and renewal)
- Maintains data consistency between Stripe and Firestore
- Supports Individual ($30/year) and Family ($50/year) memberships only (no trials)
- Provides clear member access rules based on subscription state

## Problem Statement

The current implementation handles the happy path well but lacks resilience for edge cases:

1. No idempotency protection for duplicate webhooks
2. No handling for payment failures (`incomplete`, `past_due`, `unpaid` states)
3. Missing user documents can cause webhook processing failures
4. No reconciliation mechanism for Stripe/Firestore data drift
5. Unclear access rules for various subscription states

## Business Rules (Down East Cyclists Specific)

### Membership Types

- **Individual Annual**: $30/year - Single person
- **Family Annual**: $50/year - Household coverage
- **No trial periods** - Payment required upfront

### Payment Failure Behavior

#### Initial Checkout Payment Failure

When a user attempts to join and their **initial payment fails**:

1. Stripe marks subscription as `incomplete`
2. User is **NOT** granted membership access
3. Stripe automatically expires after 23 hours → `incomplete_expired`
4. **Recommended UX**: Redirect to error page with "Payment could not be processed. Please try again."
5. **No Firestore membership record** should be created for `incomplete` subscriptions

#### Renewal Payment Failure (Existing Member)

When an **existing member's renewal payment fails**:

1. Stripe marks subscription as `past_due`
2. **Stripe handles retries automatically** (Smart Retries: up to 8 attempts over 2 weeks)
3. During retry period: Member **retains access** (they paid for a full year)
4. If all retries fail: Stripe marks as `canceled` or `unpaid` (based on Dashboard settings)
5. After final failure: Member loses access

#### Stripe Dashboard Configuration

Configure at **Billing > Revenue Recovery > Retries**:

- Use **Smart Retries** (recommended: 8 attempts over 2 weeks)
- After all retries fail: **Cancel the subscription**
- This triggers `customer.subscription.deleted` webhook

## Solution Approach

Implement a layered defense strategy:

1. **Idempotency Layer**: Track processed webhook events to prevent duplicates
2. **Graceful Degradation**: Handle missing data scenarios without failing
3. **Status-Based Access**: Define clear rules for what each status grants
4. **Incomplete Handling**: Don't create membership for incomplete subscriptions
5. **Extended Webhook Coverage**: Handle additional Stripe events

## Relevant Files

### Existing Files to Modify

- `src/lib/effect/firestore.service.ts:1-282` - Add webhook event tracking, upsert methods
- `src/lib/effect/membership.service.ts:1-315` - Add idempotency, incomplete handling
- `src/lib/effect/errors.ts:1-51` - Add new error types for edge cases
- `src/lib/effect/schemas.ts:1-177` - Add webhook event tracking schema, remove trialing references
- `app/api/webhooks/stripe/route.ts:1-87` - Add new event handlers, idempotency
- `firestore.rules:1-39` - Add webhook events collection rules
- `firestore.indexes.json:1-13` - Add indexes for new queries

### New Files to Create

- `src/lib/effect/webhook-idempotency.service.ts` - Webhook deduplication service
- `src/lib/membership-access.ts` - Membership access rules and utilities
- `app/api/admin/reconcile/route.ts` - Manual reconciliation trigger endpoint (optional)

## Implementation Phases

### Phase 1: Webhook Idempotency & Error Handling

- Add webhook event tracking to Firestore
- Implement idempotent webhook processing
- Add graceful handling for missing user documents

### Phase 2: Status-Based Access & Incomplete Handling

- Handle `checkout.session.completed` only for successful payments
- Skip creating memberships for `incomplete` subscriptions
- Define membership access rules for Individual/Family only

### Phase 3: Extended Event Coverage

- Handle `invoice.payment_failed` for logging/alerting
- Handle `customer.subscription.deleted` for cancellations
- Let Stripe handle all payment retry logic

### Phase 4: Reconciliation (Optional)

- Build reconciliation service for data drift
- Create admin endpoint for manual sync

## Step by Step Tasks

### 1. Add Webhook Event Tracking Schema

Update `src/lib/effect/schemas.ts` to add:

```typescript
// Webhook event tracking for idempotency
export const WebhookEventDocument = S.Struct({
  id: S.String, // Stripe event ID (evt_xxx)
  type: S.String, // Event type (checkout.session.completed, etc.)
  processedAt: S.Any, // Firestore Timestamp
  status: S.Literal('processing', 'completed', 'failed'),
  errorMessage: S.optional(S.String),
  retryCount: S.optional(S.Number),
});
export type WebhookEventDocument = S.Schema.Type<typeof WebhookEventDocument>;
```

Also update `MembershipStatus` to remove `trialing` from common use (keep in type for Stripe compatibility but don't actively handle it):

```typescript
// Membership status enum - matches Stripe subscription statuses
// Note: "trialing" is kept for Stripe API compatibility but DEC doesn't offer trials
export const MembershipStatus = S.Literal(
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing', // Kept for Stripe compatibility, not used by DEC
  'unpaid',
);
```

### 2. Add New Error Types

Update `src/lib/effect/errors.ts` to add:

```typescript
export class DuplicateWebhookError extends Data.TaggedError('DuplicateWebhookError')<{
  readonly eventId: string;
  readonly processedAt: Date;
}> {}

export class WebhookProcessingError extends Data.TaggedError('WebhookProcessingError')<{
  readonly eventId: string;
  readonly eventType: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class IncompletePaymentError extends Data.TaggedError('IncompletePaymentError')<{
  readonly subscriptionId: string;
  readonly status: string;
  readonly message: string;
}> {}

// Update AppError union
export type AppError =
  | StripeError
  | FirestoreError
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | AuthError
  | SessionError
  | DuplicateWebhookError
  | WebhookProcessingError
  | IncompletePaymentError;
```

### 3. Create Membership Access Rules

Create `src/lib/membership-access.ts`:

```typescript
import type {MembershipStatus} from './effect/schemas';

/**
 * Membership access configuration for Down East Cyclists
 *
 * Business Rules:
 * - Only Individual ($30/year) and Family ($50/year) memberships
 * - No trial periods
 * - Payment required upfront
 * - Stripe handles all payment retries automatically
 */

export type AccessLevel = 'full' | 'none';

export interface MembershipAccessConfig {
  status: MembershipStatus;
  accessLevel: AccessLevel;
  canAccessMemberContent: boolean;
  canAccessMemberDiscounts: boolean;
  showPaymentWarning: boolean;
  message?: string;
}

/**
 * Access rules for each subscription status
 *
 * Key decisions:
 * - "active": Full access - payment successful
 * - "past_due": FULL access retained - they paid for the year, Stripe is retrying
 * - "canceled": No access - subscription ended
 * - "incomplete": No access - initial payment never completed
 * - "incomplete_expired": No access - checkout session expired
 * - "unpaid": No access - all retry attempts exhausted
 * - "trialing": Not used by DEC, but treat as no access if encountered
 */
export const MEMBERSHIP_ACCESS_RULES: Record<MembershipStatus, MembershipAccessConfig> = {
  active: {
    status: 'active',
    accessLevel: 'full',
    canAccessMemberContent: true,
    canAccessMemberDiscounts: true,
    showPaymentWarning: false,
  },
  past_due: {
    status: 'past_due',
    accessLevel: 'full', // Keep access - they paid for the year, Stripe is retrying
    canAccessMemberContent: true,
    canAccessMemberDiscounts: true,
    showPaymentWarning: true,
    message:
      "Your renewal payment failed. We're retrying automatically. Please check your payment method.",
  },
  canceled: {
    status: 'canceled',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: false,
    message: 'Your membership has been canceled.',
  },
  incomplete: {
    status: 'incomplete',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: true,
    message: 'Payment could not be processed. Please try again.',
  },
  incomplete_expired: {
    status: 'incomplete_expired',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: false,
    message: 'Checkout session expired. Please start a new membership.',
  },
  unpaid: {
    status: 'unpaid',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: true,
    message: 'Payment failed after multiple attempts. Please update your payment method.',
  },
  trialing: {
    // Not used by DEC - treat as no access if somehow encountered
    status: 'trialing',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: false,
    message: 'Invalid membership status.',
  },
};

/**
 * Check if user has active membership access
 *
 * Returns true for:
 * - "active" status
 * - "past_due" status (they paid for the year, Stripe is handling retries)
 */
export function hasActiveMembershipAccess(status: MembershipStatus | null): boolean {
  if (!status) return false;

  // Active members have access
  // Past due members RETAIN access - they already paid for the current period
  return status === 'active' || status === 'past_due';
}

/**
 * Get access configuration for a membership status
 */
export function getMembershipAccessConfig(status: MembershipStatus): MembershipAccessConfig {
  return MEMBERSHIP_ACCESS_RULES[status];
}

/**
 * Check if a subscription status indicates a completed initial payment
 * Used to decide whether to create a Firestore membership record
 */
export function isPaymentCompleted(status: string): boolean {
  // Only create membership records for these statuses
  return status === 'active' || status === 'past_due';
}

/**
 * Check if subscription status indicates payment is pending/failed
 */
export function isPaymentPending(status: string): boolean {
  return status === 'incomplete' || status === 'incomplete_expired';
}
```

### 4. Create Webhook Idempotency Service

Create `src/lib/effect/webhook-idempotency.service.ts`:

```typescript
import {Context, Effect, Layer} from 'effect';
import {Firestore, FieldValue, Timestamp} from '@google-cloud/firestore';
import {FirestoreError, DuplicateWebhookError} from './errors';
import type {WebhookEventDocument} from './schemas';

export const WEBHOOK_EVENTS_COLLECTION = 'webhookEvents';

// Service interface
export interface WebhookIdempotencyService {
  /**
   * Check if event was already processed
   */
  readonly checkEvent: (
    eventId: string,
  ) => Effect.Effect<WebhookEventDocument | null, FirestoreError>;

  /**
   * Mark event as processing (claim it)
   * Fails if event was already claimed by another process
   */
  readonly claimEvent: (
    eventId: string,
    eventType: string,
  ) => Effect.Effect<void, FirestoreError | DuplicateWebhookError>;

  /**
   * Mark event as completed
   */
  readonly completeEvent: (eventId: string) => Effect.Effect<void, FirestoreError>;

  /**
   * Mark event as failed with error message
   */
  readonly failEvent: (
    eventId: string,
    errorMessage: string,
  ) => Effect.Effect<void, FirestoreError>;

  /**
   * Clean up old webhook events (retention: 30 days)
   */
  readonly cleanupOldEvents: (olderThanDays: number) => Effect.Effect<number, FirestoreError>;
}

// Service tag
export const WebhookIdempotencyService = Context.GenericTag<WebhookIdempotencyService>(
  'WebhookIdempotencyService',
);

// Implementation
const make = Effect.sync(() => {
  const db = new Firestore({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
    },
  });

  return WebhookIdempotencyService.of({
    checkEvent: (eventId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).get();
          if (!doc.exists) return null;
          return {id: doc.id, ...doc.data()} as WebhookEventDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'CHECK_WEBHOOK_EVENT_FAILED',
            message: `Failed to check webhook event ${eventId}`,
            cause: error,
          }),
      }),

    claimEvent: (eventId, eventType) =>
      Effect.tryPromise({
        try: async () => {
          const docRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);

          // Use transaction to ensure atomic claim
          await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);

            if (doc.exists) {
              const data = doc.data() as WebhookEventDocument;

              // Already completed? Reject as duplicate
              if (data.status === 'completed') {
                throw {isDuplicate: true, processedAt: data.processedAt};
              }

              // Failed previously? Allow retry
              if (data.status === 'failed') {
                transaction.update(docRef, {
                  status: 'processing',
                  retryCount: FieldValue.increment(1),
                  updatedAt: FieldValue.serverTimestamp(),
                });
                return;
              }

              // Still processing? Check if stale (>5 min)
              const processingTime = data.processedAt?.toDate?.() || new Date(0);
              const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

              if (processingTime > staleThreshold) {
                // Recent processing, reject as duplicate
                throw {isDuplicate: true, processedAt: data.processedAt};
              }

              // Stale lock, reclaim
              transaction.update(docRef, {
                status: 'processing',
                retryCount: FieldValue.increment(1),
                processedAt: FieldValue.serverTimestamp(),
              });
            } else {
              // New event, claim it
              transaction.set(docRef, {
                id: eventId,
                type: eventType,
                status: 'processing',
                processedAt: FieldValue.serverTimestamp(),
                retryCount: 0,
              });
            }
          });
        },
        catch: (error: any) => {
          if (error.isDuplicate) {
            return new DuplicateWebhookError({
              eventId,
              processedAt: error.processedAt?.toDate?.() || new Date(),
            });
          }
          return new FirestoreError({
            code: 'CLAIM_WEBHOOK_EVENT_FAILED',
            message: `Failed to claim webhook event ${eventId}`,
            cause: error,
          });
        },
      }),

    completeEvent: (eventId) =>
      Effect.tryPromise({
        try: () =>
          db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).update({
            status: 'completed',
            completedAt: FieldValue.serverTimestamp(),
          }),
        catch: (error) =>
          new FirestoreError({
            code: 'COMPLETE_WEBHOOK_EVENT_FAILED',
            message: `Failed to complete webhook event ${eventId}`,
            cause: error,
          }),
      }),

    failEvent: (eventId, errorMessage) =>
      Effect.tryPromise({
        try: () =>
          db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).update({
            status: 'failed',
            errorMessage,
            failedAt: FieldValue.serverTimestamp(),
          }),
        catch: (error) =>
          new FirestoreError({
            code: 'FAIL_WEBHOOK_EVENT_FAILED',
            message: `Failed to mark webhook event ${eventId} as failed`,
            cause: error,
          }),
      }),

    cleanupOldEvents: (olderThanDays) =>
      Effect.tryPromise({
        try: async () => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - olderThanDays);

          const snapshot = await db
            .collection(WEBHOOK_EVENTS_COLLECTION)
            .where('processedAt', '<', Timestamp.fromDate(cutoff))
            .limit(500)
            .get();

          if (snapshot.empty) return 0;

          const batch = db.batch();
          snapshot.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();

          return snapshot.size;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'CLEANUP_WEBHOOK_EVENTS_FAILED',
            message: 'Failed to cleanup old webhook events',
            cause: error,
          }),
      }),
  });
});

export const WebhookIdempotencyServiceLive = Layer.effect(WebhookIdempotencyService, make);
```

### 5. Update FirestoreService for Edge Cases

Add methods to `src/lib/effect/firestore.service.ts`:

```typescript
// Add to interface
readonly upsertUserByStripeCustomer: (
  stripeCustomerId: string,
  email: string,
  defaultData: Partial<UserDocument>
) => Effect.Effect<UserDocument, FirestoreError>;

readonly deleteMembership: (
  userId: string,
  membershipId: string
) => Effect.Effect<void, FirestoreError>;

// Add implementations
upsertUserByStripeCustomer: (stripeCustomerId, email, defaultData) =>
  Effect.tryPromise({
    try: async () => {
      // First try to find by Stripe customer ID
      let snapshot = await db
        .collection(COLLECTIONS.USERS)
        .where("stripeCustomerId", "==", stripeCustomerId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        // Update email if changed
        if (email && doc.data().email !== email) {
          await doc.ref.update({ email, updatedAt: FieldValue.serverTimestamp() });
        }
        return { id: doc.id, ...doc.data() } as UserDocument;
      }

      // Try by email
      if (email) {
        snapshot = await db
          .collection(COLLECTIONS.USERS)
          .where("email", "==", email)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          // Link Stripe customer to existing user
          await doc.ref.update({
            stripeCustomerId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return { id: doc.id, ...doc.data(), stripeCustomerId } as UserDocument;
        }
      }

      // Create new user with Stripe customer ID as document ID
      const userId = stripeCustomerId;
      await db.collection(COLLECTIONS.USERS).doc(userId).set({
        id: userId,
        email: email || "",
        stripeCustomerId,
        ...defaultData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        id: userId,
        email: email || "",
        stripeCustomerId,
        ...defaultData,
      } as UserDocument;
    },
    catch: (error) =>
      new FirestoreError({
        code: "UPSERT_USER_BY_STRIPE_CUSTOMER_FAILED",
        message: `Failed to upsert user for Stripe customer ${stripeCustomerId}`,
        cause: error,
      }),
  }),

deleteMembership: (userId, membershipId) =>
  Effect.tryPromise({
    try: () =>
      db
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection(COLLECTIONS.MEMBERSHIPS)
        .doc(membershipId)
        .delete(),
    catch: (error) =>
      new FirestoreError({
        code: "DELETE_MEMBERSHIP_FAILED",
        message: `Failed to delete membership ${membershipId} for user ${userId}`,
        cause: error,
      }),
  }),
```

### 6. Update MembershipService for Payment Status Handling

Update `src/lib/effect/membership.service.ts`:

Key changes:

1. In `processCheckoutCompleted`: Only create membership if subscription is `active`
2. Add `processInvoicePaymentFailed`: Log for alerting (Stripe handles retries)
3. Handle `incomplete` subscriptions by NOT creating membership records

```typescript
// Update processCheckoutCompleted to check subscription status
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

    // IMPORTANT: Only create membership for active subscriptions
    // If status is "incomplete", payment failed - don't create membership
    if (subscription.status === "incomplete" || subscription.status === "incomplete_expired") {
      yield* Effect.log(
        `Skipping membership creation - subscription ${subscriptionId} has status: ${subscription.status}`
      );
      return;
    }

    // ... rest of existing implementation for active subscriptions
  }),

// Add method for logging payment failures (Stripe handles retries)
processInvoicePaymentFailed: (invoice) =>
  Effect.gen(function* () {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;
    const attemptCount = invoice.attempt_count || 1;

    yield* Effect.log(
      `Payment failed for subscription ${subscriptionId}, attempt ${attemptCount}`
    );

    // Stripe handles automatic retries via Smart Retries
    // This handler is primarily for logging/alerting
    // Member retains access during past_due period (they paid for the year)

    // Optional: Send notification to admin
    // Optional: Update UI to show payment warning (subscription status will be "past_due")

    yield* Effect.log(
      `Stripe will automatically retry payment. Subscription status should be past_due.`
    );
  }),
```

### 7. Update Webhook Handler with Idempotency

Update `app/api/webhooks/stripe/route.ts`:

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {Effect, pipe} from 'effect';
import {headers} from 'next/headers';
import type Stripe from 'stripe';
import {StripeService} from '@/src/lib/effect/stripe.service';
import {MembershipService} from '@/src/lib/effect/membership.service';
import {WebhookIdempotencyService} from '@/src/lib/effect/webhook-idempotency.service';
import {LiveLayerWithIdempotency} from '@/src/lib/effect/layers';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({error: 'Missing stripe-signature header'}, {status: 400});
  }

  const program = pipe(
    // Step 1: Verify webhook signature
    Effect.flatMap(StripeService, (stripe) => stripe.verifyWebhookSignature(body, signature)),

    // Step 2: Check idempotency and claim event
    Effect.flatMap((event) =>
      Effect.flatMap(WebhookIdempotencyService, (idempotency) =>
        pipe(
          idempotency.claimEvent(event.id, event.type),
          Effect.map(() => event),
          // If duplicate, return success (already processed)
          Effect.catchTag('DuplicateWebhookError', (err) => {
            console.log(`Duplicate webhook ${err.eventId}, skipping`);
            return Effect.succeed({...event, _alreadyProcessed: true});
          }),
        ),
      ),
    ),

    // Step 3: Process event (skip if already processed)
    Effect.flatMap((event: Stripe.Event & {_alreadyProcessed?: boolean}) => {
      if (event._alreadyProcessed) {
        return Effect.succeed({received: true, duplicate: true});
      }

      return Effect.flatMap(MembershipService, (membershipService) =>
        Effect.flatMap(WebhookIdempotencyService, (idempotency) =>
          pipe(
            Effect.gen(function* () {
              yield* Effect.log(`Processing webhook: ${event.type}`);

              switch (event.type) {
                case 'checkout.session.completed': {
                  const session = event.data.object as Stripe.Checkout.Session;
                  yield* membershipService.processCheckoutCompleted(session);
                  break;
                }

                case 'customer.subscription.updated': {
                  const subscription = event.data.object as Stripe.Subscription;
                  yield* membershipService.processSubscriptionUpdated(subscription);
                  break;
                }

                case 'customer.subscription.deleted': {
                  const subscription = event.data.object as Stripe.Subscription;
                  yield* membershipService.processSubscriptionDeleted(subscription);
                  break;
                }

                case 'invoice.payment_failed': {
                  // Log for alerting - Stripe handles retries automatically
                  const invoice = event.data.object as Stripe.Invoice;
                  yield* Effect.log(
                    `Payment failed: subscription ${invoice.subscription}, attempt ${invoice.attempt_count}`,
                  );
                  // Member retains access during retry period (past_due status)
                  break;
                }

                case 'invoice.paid': {
                  // Payment succeeded (initial or retry)
                  const invoice = event.data.object as Stripe.Invoice;
                  yield* Effect.log(`Payment succeeded: subscription ${invoice.subscription}`);
                  break;
                }

                default:
                  yield* Effect.log(`Unhandled event type: ${event.type}`);
              }

              return {received: true};
            }),
            // Mark as completed on success
            Effect.tap(() => idempotency.completeEvent(event.id)),
            // Mark as failed on error
            Effect.catchAll((error) =>
              pipe(
                idempotency.failEvent(event.id, String(error)),
                Effect.flatMap(() => Effect.fail(error)),
              ),
            ),
          ),
        ),
      );
    }),

    // Error handling - always return 200 to Stripe to prevent infinite retries
    Effect.catchTag('StripeError', (error) => {
      console.error('Stripe error:', error);
      return Effect.succeed({error: error.message, _tag: 'error' as const, status: 400});
    }),
    Effect.catchTag('FirestoreError', (error) => {
      console.error('Firestore error:', error);
      return Effect.succeed({received: true, error: error.message});
    }),
    Effect.catchAll((error) => {
      console.error('Unexpected error:', error);
      return Effect.succeed({received: true, error: String(error)});
    }),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayerWithIdempotency)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}
```

### 8. Update Layer Composition

Update `src/lib/effect/layers.ts`:

```typescript
import {Layer} from 'effect';
import {StripeService, StripeServiceLive} from './stripe.service';
import {FirestoreService, FirestoreServiceLive} from './firestore.service';
import {MembershipService, MembershipServiceLive} from './membership.service';
import {
  WebhookIdempotencyService,
  WebhookIdempotencyServiceLive,
} from './webhook-idempotency.service';

// Base layers
const BaseLayer = Layer.merge(StripeServiceLive, FirestoreServiceLive);

// Original LiveLayer (without idempotency) - for non-webhook use
export const LiveLayer = MembershipServiceLive.pipe(Layer.provide(BaseLayer));

// LiveLayer with idempotency - for webhook processing
export const LiveLayerWithIdempotency = Layer.mergeAll(
  MembershipServiceLive,
  WebhookIdempotencyServiceLive,
).pipe(Layer.provide(BaseLayer));

// Type exports
export type LiveServices = StripeService | FirestoreService | MembershipService;
export type WebhookServices = LiveServices | WebhookIdempotencyService;
```

### 9. Update Firestore Rules

Update `firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow write: if false; // Admin SDK only

      // Memberships subcollection
      match /memberships/{membershipId} {
        allow read: if isOwner(userId);
        allow write: if false; // Admin SDK only
      }
    }

    // Membership Plans collection (public read)
    match /membershipPlans/{planId} {
      allow read: if true;
      allow write: if false;
    }

    // Webhook Events collection (server-only, no client access)
    match /webhookEvents/{eventId} {
      allow read: if false;
      allow write: if false; // Admin SDK only
    }

    // Trails collection (existing)
    match /trails/{trailId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### 10. Update Firestore Indexes

Update `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "memberships",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "endDate", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "webhookEvents",
      "queryScope": "COLLECTION",
      "fields": [{"fieldPath": "processedAt", "order": "ASCENDING"}]
    }
  ],
  "fieldOverrides": []
}
```

### 11. Update getMembershipStatus for Access Rules

Update the `getMembershipStatus` method in `membership.service.ts` to use access rules:

```typescript
import { hasActiveMembershipAccess, getMembershipAccessConfig } from "../membership-access";

// In getMembershipStatus:
getMembershipStatus: (userId) =>
  Effect.gen(function* () {
    const user = yield* firestore.getUser(userId);

    if (!user) {
      return yield* Effect.fail(
        new NotFoundError({ resource: "user", id: userId })
      );
    }

    const membership = yield* firestore.getActiveMembership(userId);

    let membershipData = null;
    let accessConfig = null;

    if (membership) {
      const planName = getPlanNameForType(membership.planType);
      accessConfig = getMembershipAccessConfig(membership.status);

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
      // Use access rules to determine if member has access
      isActive: hasActiveMembershipAccess(membership?.status || null),
      membership: membershipData,
      // Include access config for UI messaging
      accessMessage: accessConfig?.message || null,
      showPaymentWarning: accessConfig?.showPaymentWarning || false,
    };
  }),
```

### 12. Validate Implementation

Run the following validations:

- TypeScript compilation
- Build check
- Test duplicate webhook handling
- Test incomplete subscription handling

## Testing Strategy

### Manual Testing Scenarios

1. **Happy Path**
   - Complete checkout with valid card
   - Verify membership created in Firestore with `active` status
   - Verify member has access

2. **Initial Payment Failure**
   - Use test card `4000 0000 0000 0002` (always declines)
   - Verify subscription has `incomplete` status
   - Verify NO membership record created in Firestore
   - Verify user redirected to error page

3. **Duplicate Webhook**
   - Use Stripe CLI: `stripe trigger checkout.session.completed`
   - Resend same event
   - Verify second event logged as "duplicate, skipping"

4. **Renewal Payment Failure**
   - Create active membership
   - Trigger `invoice.payment_failed` webhook
   - Verify member STILL has access (past_due retains access)
   - Verify payment warning shown in UI

5. **Cancellation**
   - Cancel subscription in Stripe Dashboard
   - Verify `customer.subscription.deleted` webhook received
   - Verify membership status updated to `canceled`
   - Verify member loses access

### Stripe Test Cards

| Card Number         | Behavior                      |
| ------------------- | ----------------------------- |
| 4242 4242 4242 4242 | Succeeds                      |
| 4000 0000 0000 0002 | Declines (generic)            |
| 4000 0000 0000 9995 | Declines (insufficient funds) |
| 4000 0027 6000 3184 | Requires authentication       |

## Acceptance Criteria

- [ ] Webhook events tracked in `webhookEvents` collection
- [ ] Duplicate webhooks detected and skipped (return 200)
- [ ] `incomplete` subscriptions do NOT create membership records
- [ ] `past_due` members retain full access (they paid for the year)
- [ ] Membership access rules correctly determine access for all statuses
- [ ] `customer.subscription.deleted` properly updates membership to canceled
- [ ] No "trialing" membership handling (DEC doesn't offer trials)
- [ ] All TypeScript types pass compilation
- [ ] Next.js build succeeds

## Validation Commands

```bash
# TypeScript check
pnpm tsc --noEmit

# Next.js build
pnpm build

# Test webhook idempotency (requires Stripe CLI)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed  # Should log "duplicate"

# Test payment failure
stripe trigger invoice.payment_failed

# Test cancellation
stripe trigger customer.subscription.deleted
```

## Notes

### Stripe Dashboard Configuration

Go to **Billing > Revenue Recovery > Retries**:

1. Enable **Smart Retries**
2. Set: 8 retries over 2 weeks (recommended)
3. After all retries fail: **Cancel the subscription**

### Webhooks to Configure

In Stripe Dashboard, ensure these events are enabled:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed` (for logging/alerting)
- `invoice.paid` (for logging)

### Key Business Decisions

1. **No grace period needed** - Stripe handles all retry logic
2. **`past_due` = full access** - Member paid for the year, we're just retrying renewal
3. **`incomplete` = no access** - Initial payment never completed
4. **No trials** - Only Individual ($30) and Family ($50) annual memberships
5. **Let Stripe handle retries** - Don't implement custom retry logic

# Plan: Stripe Membership Management System - Phase 1 (Effect-TS Refactored)

## Task Description

Implement a comprehensive membership management system for Down East Cyclists using Stripe for payment processing and Google Firestore for data persistence. This phase covers core Stripe integration, Firestore database schema design, checkout flow, webhook handling, and membership status APIs — all orchestrated with **Effect-TS** for type-safe data flow, error handling, and service composition.

## Objective

Deliver a fully functional membership subscription system that allows users to:

- Purchase Individual ($30/year) or Family ($50/year) memberships via Stripe Checkout
- Have their membership status automatically tracked in Firestore
- Query their membership status through a dedicated API endpoint

**Effect-TS Integration Goals:**

- All data operations use Effect services with proper dependency injection
- Tagged errors enable granular error handling at API boundaries
- Effect Schema provides runtime validation for all external data
- Effect.pipe chains provide readable, composable data flows

## Problem Statement

The cycling club currently has no digital membership management system. Members need a way to purchase and renew annual memberships online, with automatic tracking of subscription status. The system must integrate Stripe's subscription billing with Firestore's real-time database to maintain accurate membership records.

## Solution Approach

1. **Leverage existing Stripe products**: Two membership products already exist in Stripe:
   - Individual Annual: `prod_TTd2cYLRwV1lby` @ $30/year (`price_1SWflzFmXLvhjtKwhFF4WM5Z`)
   - Family Annual: `prod_TTcv9mJWkXjr91` @ $50/year (`price_1SWfg7FmXLvhjtKwoDzxhEZ6`)

2. **Follow existing patterns**: Use the established API route pattern in `/app/api/` with Google Cloud Firestore service account authentication (see `app/api/trails/route.ts:16-50`)

3. **Webhook-driven updates**: Use Stripe webhooks to ensure Firestore stays synchronized with Stripe subscription state

4. **Effect-TS Service Layer**: Wrap all external integrations in Effect services for composability and error handling

## Effect-TS Layer Architecture

```mermaid
┌─────────────────────────────────────────────────────────────────┐
│                      API Routes (Next.js)                       │
│         Effect.runPromise(program.pipe(Effect.provide(Live)))   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MembershipService                            │
│    (Business logic layer - orchestrates Stripe + Firestore)     │
│    - createCheckoutSession                                      │
│    - processWebhookEvent                                        │
│    - getMembershipStatus                                        │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     StripeService       │   │    FirestoreService     │
│   (Effect.Service)      │   │    (Effect.Service)     │
│   - createSession       │   │    - getUser            │
│   - retrieveSubscription│   │    - setUser            │
│   - verifyWebhook       │   │    - getMembership      │
│   - getCustomer         │   │    - setMembership      │
└─────────────────────────┘   └─────────────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   Stripe SDK (stripe)   │   │  Firestore Admin SDK    │
│                         │   │  (@google-cloud/...)    │
└─────────────────────────┘   └─────────────────────────┘
```

## Relevant Files

### Existing Files to Reference

- `app/api/trails/route.ts:16-50` - Reference pattern for Firestore Admin SDK usage in API routes (GET with caching)
- `app/api/trails/[id]/route.ts:11-58` - Reference pattern for authenticated PATCH operations with Admin SDK
- `src/utils/firebase.ts:1-56` - Client-side Firebase configuration (Auth only - DO NOT use for server-side writes)
- `middleware.ts:1-72` - Authentication and caching middleware patterns
- `package.json:23` - Already has `@google-cloud/firestore` dependency

### New Files to Create

#### Effect Services Layer

- `src/lib/effect/errors.ts` - Tagged error definitions (StripeError, FirestoreError, ValidationError)
- `src/lib/effect/schemas.ts` - Effect Schema definitions for all data types
- `src/lib/effect/stripe.service.ts` - StripeService (Effect.Service)
- `src/lib/effect/firestore.service.ts` - FirestoreService (Effect.Service)
- `src/lib/effect/membership.service.ts` - MembershipService (business logic)
- `src/lib/effect/layers.ts` - Layer composition (Live, Test)

#### Types (Effect Schema)

- `src/types/membership.ts` - TypeScript interfaces + Effect Schema codecs

#### API Routes

- `app/api/checkout/route.ts` - Create Stripe Checkout sessions
- `app/api/webhooks/stripe/route.ts` - Stripe webhook handler
- `app/api/membership/[userId]/route.ts` - Membership status endpoint
- `app/api/membership/plans/route.ts` - List available membership plans

#### Infrastructure

- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Required composite indexes

## Implementation Phases

### Phase 1: Foundation

- Install dependencies (Effect, Stripe SDK)
- Create tagged error types
- Define Effect Schema codecs for all data types
- Set up environment variables

### Phase 2: Service Layer

- Create StripeService with Effect patterns
- Create FirestoreService with Effect patterns
- Create MembershipService (business logic layer)
- Compose layers with Layer.provide()

### Phase 3: API Integration

- Implement checkout endpoint using Effect.runPromise
- Implement webhook handler with Effect pipelines
- Create membership status endpoint
- Add error boundary strategy

### Phase 4: Polish

- Implement security rules
- Add logging via Effect.tap
- Test end-to-end flow
- Document API endpoints

## Step by Step Tasks

### 1. Install Dependencies

```bash
pnpm add stripe effect @effect/schema
```

### 2. Configure Environment Variables

Add the following to `.env.local`:

```.env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Create Tagged Error Types

Create `src/lib/effect/errors.ts`:

```typescript
import { Data } from "effect";

// Tagged errors for granular handling with Effect.catchTag
export class StripeError extends Data.TaggedError("StripeError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FirestoreError extends Data.TaggedError("FirestoreError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

// Union type for all errors
export type AppError =
  | StripeError
  | FirestoreError
  | ValidationError
  | NotFoundError
  | UnauthorizedError;
```

### 4. Create Effect Schema Definitions

Create `src/lib/effect/schemas.ts`:

```typescript
import { Schema as S } from "@effect/schema";

// Membership status enum
export const MembershipStatus = S.Literal(
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "unpaid"
);
export type MembershipStatus = S.Schema.Type<typeof MembershipStatus>;

// Plan type enum
export const PlanType = S.Literal("individual", "family");
export type PlanType = S.Schema.Type<typeof PlanType>;

// Address schema
export const Address = S.Struct({
  street: S.optional(S.String),
  city: S.optional(S.String),
  state: S.optional(S.String),
  zip: S.optional(S.String),
});

// User document schema
export const UserDocument = S.Struct({
  id: S.String,
  email: S.String,
  name: S.optional(S.String),
  phone: S.optional(S.String),
  address: S.optional(Address),
  stripeCustomerId: S.optional(S.String),
  createdAt: S.Any, // Firestore Timestamp
  updatedAt: S.Any, // Firestore Timestamp
});
export type UserDocument = S.Schema.Type<typeof UserDocument>;

// Membership document schema
export const MembershipDocument = S.Struct({
  id: S.String,
  stripeSubscriptionId: S.String,
  planType: PlanType,
  status: MembershipStatus,
  startDate: S.Any, // Firestore Timestamp
  endDate: S.Any, // Firestore Timestamp
  autoRenew: S.Boolean,
  createdAt: S.Any,
  updatedAt: S.Any,
});
export type MembershipDocument = S.Schema.Type<typeof MembershipDocument>;

// Membership plan schema
export const MembershipPlanDocument = S.Struct({
  id: S.String,
  name: S.String,
  description: S.String,
  stripePriceId: S.String,
  price: S.Number,
  interval: S.Literal("year", "month"),
  benefits: S.Array(S.String),
  isActive: S.Boolean,
  sortOrder: S.Number,
});
export type MembershipPlanDocument = S.Schema.Type<typeof MembershipPlanDocument>;

// API Request schemas
export const CheckoutSessionRequest = S.Struct({
  priceId: S.String,
  userId: S.optional(S.String),
  email: S.optional(S.String),
  successUrl: S.String,
  cancelUrl: S.String,
});
export type CheckoutSessionRequest = S.Schema.Type<typeof CheckoutSessionRequest>;

// API Response schemas
export const CheckoutSessionResponse = S.Struct({
  sessionId: S.String,
  url: S.String,
});
export type CheckoutSessionResponse = S.Schema.Type<typeof CheckoutSessionResponse>;

export const MembershipStatusResponse = S.Struct({
  userId: S.String,
  email: S.String,
  isActive: S.Boolean,
  membership: S.NullOr(
    S.Struct({
      planType: PlanType,
      planName: S.String,
      status: MembershipStatus,
      endDate: S.String, // ISO date string
      autoRenew: S.Boolean,
    })
  ),
});
export type MembershipStatusResponse = S.Schema.Type<typeof MembershipStatusResponse>;

// Stripe webhook payload schemas
export const StripeWebhookEvent = S.Struct({
  id: S.String,
  type: S.String,
  data: S.Struct({
    object: S.Any, // Stripe object varies by event type
  }),
});
export type StripeWebhookEvent = S.Schema.Type<typeof StripeWebhookEvent>;
```

### 5. Create StripeService

Create `src/lib/effect/stripe.service.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import { Schema as S } from "@effect/schema";
import Stripe from "stripe";
import { StripeError, ValidationError } from "./errors";
import { CheckoutSessionRequest } from "./schemas";

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

// Valid price IDs
const VALID_PRICE_IDS = [
  "price_1SWflzFmXLvhjtKwhFF4WM5Z", // Individual
  "price_1SWfg7FmXLvhjtKwoDzxhEZ6", // Family
];

// Implementation using Effect.gen for complex flows
const make = Effect.gen(function* () {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return yield* Effect.fail(
      new StripeError({
        code: "MISSING_CONFIG",
        message: "STRIPE_SECRET_KEY environment variable is not set",
      })
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
  });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  return StripeService.of({
    createCheckoutSession: (params) =>
      Effect.gen(function* () {
        // Validate price ID
        if (!VALID_PRICE_IDS.includes(params.priceId)) {
          return yield* Effect.fail(
            new ValidationError({
              field: "priceId",
              message: "Invalid price ID",
            })
          );
        }

        // Validate email or userId present
        if (!params.userId && !params.email) {
          return yield* Effect.fail(
            new ValidationError({
              field: "email",
              message: "Either userId or email is required",
            })
          );
        }

        return yield* Effect.tryPromise({
          try: () =>
            stripe.checkout.sessions.create({
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
            }),
          catch: (error) =>
            new StripeError({
              code: "SESSION_CREATE_FAILED",
              message: "Failed to create checkout session",
              cause: error,
            }),
        });
      }),

    retrieveSubscription: (subscriptionId) =>
      Effect.tryPromise({
        try: () => stripe.subscriptions.retrieve(subscriptionId),
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
        try: () => stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>,
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
```

### 6. Create FirestoreService

Create `src/lib/effect/firestore.service.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { FirestoreError, NotFoundError } from "./errors";
import type { UserDocument, MembershipDocument, MembershipPlanDocument } from "./schemas";

// Collection names
export const COLLECTIONS = {
  USERS: "users",
  MEMBERSHIPS: "memberships",
  MEMBERSHIP_PLANS: "membershipPlans",
} as const;

// Service interface
export interface FirestoreService {
  readonly getUser: (
    userId: string
  ) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly getUserByEmail: (
    email: string
  ) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly getUserByStripeCustomerId: (
    customerId: string
  ) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly setUser: (
    userId: string,
    data: Partial<UserDocument>,
    merge?: boolean
  ) => Effect.Effect<void, FirestoreError>;

  readonly getMembership: (
    userId: string,
    membershipId: string
  ) => Effect.Effect<MembershipDocument | null, FirestoreError>;

  readonly getActiveMembership: (
    userId: string
  ) => Effect.Effect<MembershipDocument | null, FirestoreError>;

  readonly setMembership: (
    userId: string,
    membershipId: string,
    data: Omit<MembershipDocument, "id">
  ) => Effect.Effect<void, FirestoreError>;

  readonly updateMembership: (
    userId: string,
    membershipId: string,
    data: Partial<MembershipDocument>
  ) => Effect.Effect<void, FirestoreError>;

  readonly getPlans: () => Effect.Effect<MembershipPlanDocument[], FirestoreError>;

  readonly getPlan: (
    planId: string
  ) => Effect.Effect<MembershipPlanDocument | null, FirestoreError>;
}

// Service tag
export const FirestoreService = Context.GenericTag<FirestoreService>("FirestoreService");

// Create Firestore instance
const createFirestoreInstance = (): Firestore => {
  return new Firestore({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
    },
  });
};

// Implementation
const make = Effect.sync(() => {
  const db = createFirestoreInstance();

  return FirestoreService.of({
    getUser: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
          if (!doc.exists) return null;
          return { id: doc.id, ...doc.data() } as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_USER_FAILED",
            message: `Failed to get user ${userId}`,
            cause: error,
          }),
      }),

    getUserByEmail: (email) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.USERS)
            .where("email", "==", email)
            .limit(1)
            .get();
          if (snapshot.empty) return null;
          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() } as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_USER_BY_EMAIL_FAILED",
            message: `Failed to get user by email ${email}`,
            cause: error,
          }),
      }),

    getUserByStripeCustomerId: (customerId) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.USERS)
            .where("stripeCustomerId", "==", customerId)
            .limit(1)
            .get();
          if (snapshot.empty) return null;
          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() } as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_USER_BY_CUSTOMER_ID_FAILED",
            message: `Failed to get user by Stripe customer ID ${customerId}`,
            cause: error,
          }),
      }),

    setUser: (userId, data, merge = true) =>
      Effect.tryPromise({
        try: () =>
          db.collection(COLLECTIONS.USERS).doc(userId).set(
            {
              ...data,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge }
          ),
        catch: (error) =>
          new FirestoreError({
            code: "SET_USER_FAILED",
            message: `Failed to set user ${userId}`,
            cause: error,
          }),
      }),

    getMembership: (userId, membershipId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection(COLLECTIONS.MEMBERSHIPS)
            .doc(membershipId)
            .get();
          if (!doc.exists) return null;
          return { id: doc.id, ...doc.data() } as MembershipDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_MEMBERSHIP_FAILED",
            message: `Failed to get membership ${membershipId} for user ${userId}`,
            cause: error,
          }),
      }),

    getActiveMembership: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection(COLLECTIONS.MEMBERSHIPS)
            .where("status", "in", ["active", "trialing", "past_due"])
            .orderBy("endDate", "desc")
            .limit(1)
            .get();
          if (snapshot.empty) return null;
          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() } as MembershipDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_ACTIVE_MEMBERSHIP_FAILED",
            message: `Failed to get active membership for user ${userId}`,
            cause: error,
          }),
      }),

    setMembership: (userId, membershipId, data) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection(COLLECTIONS.MEMBERSHIPS)
            .doc(membershipId)
            .set({
              ...data,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            }),
        catch: (error) =>
          new FirestoreError({
            code: "SET_MEMBERSHIP_FAILED",
            message: `Failed to set membership ${membershipId} for user ${userId}`,
            cause: error,
          }),
      }),

    updateMembership: (userId, membershipId, data) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection(COLLECTIONS.MEMBERSHIPS)
            .doc(membershipId)
            .update({
              ...data,
              updatedAt: FieldValue.serverTimestamp(),
            }),
        catch: (error) =>
          new FirestoreError({
            code: "UPDATE_MEMBERSHIP_FAILED",
            message: `Failed to update membership ${membershipId} for user ${userId}`,
            cause: error,
          }),
      }),

    getPlans: () =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.MEMBERSHIP_PLANS)
            .where("isActive", "==", true)
            .orderBy("sortOrder", "asc")
            .get();
          return snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as MembershipPlanDocument
          );
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_PLANS_FAILED",
            message: "Failed to get membership plans",
            cause: error,
          }),
      }),

    getPlan: (planId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db
            .collection(COLLECTIONS.MEMBERSHIP_PLANS)
            .doc(planId)
            .get();
          if (!doc.exists) return null;
          return { id: doc.id, ...doc.data() } as MembershipPlanDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: "GET_PLAN_FAILED",
            message: `Failed to get plan ${planId}`,
            cause: error,
          }),
      }),
  });
});

// Live layer
export const FirestoreServiceLive = Layer.effect(FirestoreService, make);
```

### 7. Create MembershipService (Business Logic)

Create `src/lib/effect/membership.service.ts`:

```typescript
import { Context, Effect, Layer, pipe } from "effect";
import { Schema as S } from "@effect/schema";
import type Stripe from "stripe";
import { StripeService } from "./stripe.service";
import { FirestoreService, COLLECTIONS } from "./firestore.service";
import {
  StripeError,
  FirestoreError,
  ValidationError,
  NotFoundError,
} from "./errors";
import {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  MembershipStatusResponse,
  MembershipStatus,
} from "./schemas";

// Price ID to plan type mapping
const PRICE_TO_PLAN: Record<string, "individual" | "family"> = {
  "price_1SWflzFmXLvhjtKwhFF4WM5Z": "individual",
  "price_1SWfg7FmXLvhjtKwoDzxhEZ6": "family",
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
          createdAt: new Date() as any,
        });

        // Create membership document
        yield* firestore.setMembership(userDocId, subscriptionId, {
          stripeSubscriptionId: subscriptionId,
          planType,
          status: subscription.status as MembershipStatus,
          startDate: new Date(subscription.current_period_start * 1000) as any,
          endDate: new Date(subscription.current_period_end * 1000) as any,
          autoRenew: !subscription.cancel_at_period_end,
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        });

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

        // Update membership
        yield* firestore.updateMembership(user.id, subscriptionId, {
          status: subscription.status as MembershipStatus,
          startDate: new Date(subscription.current_period_start * 1000) as any,
          endDate: new Date(subscription.current_period_end * 1000) as any,
          autoRenew: !subscription.cancel_at_period_end,
        });

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

        let membershipData: MembershipStatusResponse["membership"] = null;

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
              new Date(membership.endDate as any).toISOString(),
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
            benefits: p.benefits,
          }))
        )
      ),
  });
});

// Live layer - requires StripeService and FirestoreService
export const MembershipServiceLive = Layer.effect(MembershipService, make);
```

### 8. Create Layer Composition

Create `src/lib/effect/layers.ts`:

```typescript
import { Layer } from "effect";
import { StripeService, StripeServiceLive } from "./stripe.service";
import { FirestoreService, FirestoreServiceLive } from "./firestore.service";
import { MembershipService, MembershipServiceLive } from "./membership.service";

// Compose all live layers
// Layer.provide handles the dependency injection
export const LiveLayer = MembershipServiceLive.pipe(
  Layer.provide(StripeServiceLive),
  Layer.provide(FirestoreServiceLive)
);

// Type for services available in LiveLayer
export type LiveServices = StripeService | FirestoreService | MembershipService;
```

### 9. Implement Checkout Session Endpoint

Create `app/api/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { Schema as S } from "@effect/schema";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";
import { CheckoutSessionRequest } from "@/src/lib/effect/schemas";
import { ValidationError, StripeError, FirestoreError } from "@/src/lib/effect/errors";

export async function POST(request: NextRequest) {
  // Parse request body
  const body = await request.json();

  // Define the Effect program
  const program = pipe(
    // Step 1: Validate input with Effect Schema
    S.decodeUnknown(CheckoutSessionRequest)(body),
    Effect.mapError(
      (error) =>
        new ValidationError({
          field: "body",
          message: "Invalid request body",
          cause: error,
        })
    ),

    // Step 2: Create checkout session
    Effect.flatMap((validatedRequest) =>
      Effect.gen(function* () {
        const membershipService = yield* MembershipService;
        return yield* membershipService.createCheckoutSession(validatedRequest);
      })
    ),

    // Step 3: Handle specific errors with catchTag
    Effect.catchTag("ValidationError", (error) =>
      Effect.succeed({
        error: error.message,
        field: error.field,
        _tag: "error" as const,
        status: 400,
      })
    ),
    Effect.catchTag("StripeError", (error) =>
      Effect.succeed({
        error: error.message,
        code: error.code,
        _tag: "error" as const,
        status: 500,
      })
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({
        error: error.message,
        _tag: "error" as const,
        status: 500,
      })
    )
  );

  // Run with live services
  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  // Return appropriate response
  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(result);
}
```

### 10. Implement Stripe Webhook Handler

Create `app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { StripeService } from "@/src/lib/effect/stripe.service";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Define the webhook processing pipeline
  const program = pipe(
    // Step 1: Verify webhook signature
    Effect.gen(function* () {
      const stripe = yield* StripeService;
      return yield* stripe.verifyWebhookSignature(body, signature);
    }),

    // Step 2: Process event based on type
    Effect.flatMap((event) =>
      Effect.gen(function* () {
        const membershipService = yield* MembershipService;

        yield* Effect.log(`Processing webhook event: ${event.type}`);

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            yield* membershipService.processCheckoutCompleted(session);
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            yield* membershipService.processSubscriptionUpdated(subscription);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            yield* membershipService.processSubscriptionDeleted(subscription);
            break;
          }

          default:
            yield* Effect.log(`Unhandled event type: ${event.type}`);
        }

        return { received: true };
      })
    ),

    // Step 3: Error handling
    Effect.catchTag("StripeError", (error) => {
      console.error("Stripe error in webhook:", error);
      return Effect.succeed({ error: error.message, _tag: "error" as const, status: 400 });
    }),
    Effect.catchTag("FirestoreError", (error) => {
      console.error("Firestore error in webhook:", error);
      return Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 });
    })
  );

  // Run with live services
  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
```

### 11. Implement Membership Status Endpoint

Create `app/api/membership/[userId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const membershipService = yield* MembershipService;
      return yield* membershipService.getMembershipStatus(userId);
    }),

    Effect.catchTag("NotFoundError", (error) =>
      Effect.succeed({
        error: `${error.resource} not found`,
        _tag: "error" as const,
        status: 404,
      })
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({
        error: error.message,
        _tag: "error" as const,
        status: 500,
      })
    )
  );

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
```

### 12. Implement Membership Plans Endpoint

Create `app/api/membership/plans/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";

// In-memory cache for plans
let cachedPlans: any[] | null = null;
let cachedAt: number = 0;
const CACHE_TTL = 300_000; // 5 minutes

export async function GET() {
  const now = Date.now();

  // Return cached plans if valid
  if (cachedPlans && now - cachedAt < CACHE_TTL) {
    return NextResponse.json(cachedPlans);
  }

  const program = pipe(
    Effect.gen(function* () {
      const membershipService = yield* MembershipService;
      return yield* membershipService.getPlans();
    }),

    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({
        error: error.message,
        _tag: "error" as const,
        status: 500,
      })
    )
  );

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Update cache
  cachedPlans = result;
  cachedAt = now;

  return NextResponse.json(result);
}
```

### 13. Create Firestore Security Rules

Create `firestore.rules`:

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

    // Trails collection (existing)
    match /trails/{trailId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### 14. Create Firestore Indexes

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "memberships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "endDate", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 15. Update Middleware for Webhook Route

Update `middleware.ts:60-72` to exclude webhook routes:

```typescript
export const config = {
  matcher: [
    "/((?!api/trails|api/submit-form|api/webhooks|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

### 16. Validate Implementation

- Run TypeScript compiler to check for type errors
- Test checkout session creation with valid price IDs
- Use Stripe CLI to trigger test webhooks
- Verify Firestore documents are created correctly
- Test membership status endpoint

## Effect-TS Pattern Guide

### When to use Effect.pipe vs Effect.gen

| Pattern | Use When | Example |
|---------|----------|---------|
| `Effect.pipe` | Simple linear transformations, mapping, error handling | `pipe(getData, Effect.map(transform), Effect.catchTag(...))` |
| `Effect.gen` | Complex flows with multiple dependent operations, conditional logic | Webhook processing, checkout creation |
| `Effect.all` | Parallel independent operations | Fetching user and plans simultaneously |

### Error Handling Strategy

```typescript
// In services: use Effect.fail with tagged errors
return yield* Effect.fail(new StripeError({ code: "...", message: "..." }));

// In API routes: use catchTag for specific handling
Effect.catchTag("StripeError", (error) => ...)
Effect.catchTag("ValidationError", (error) => ...)
Effect.catchTag("FirestoreError", (error) => ...)

// Never throw - always use Effect.fail
```

### Layer Architecture Benefits

1. **Dependency Injection**: Services are injected via `Effect.provide(LiveLayer)`
2. **Testability**: Swap `LiveLayer` for `TestLayer` in tests
3. **Type Safety**: TypeScript ensures all dependencies are satisfied
4. **Composability**: Layers can be combined and reused

## Firestore Collections Structure

```text
users/{userId}
├── id: string
├── email: string
├── name?: string
├── stripeCustomerId?: string
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── memberships/ (subcollection)
    └── {subscriptionId}
        ├── stripeSubscriptionId: string
        ├── planType: "individual" | "family"
        ├── status: MembershipStatus
        ├── startDate: Timestamp
        ├── endDate: Timestamp
        ├── autoRenew: boolean
        └── timestamps...

membershipPlans/{planId}
├── id: string
├── name: string
├── stripePriceId: string
├── price: number
├── benefits: string[]
└── ...
```

## Acceptance Criteria

- [ ] Effect-TS (`effect`, `@effect/schema`) packages installed
- [ ] Tagged errors defined: `StripeError`, `FirestoreError`, `ValidationError`, `NotFoundError`
- [ ] Effect Schema codecs defined for all API request/response types
- [ ] `StripeService` implemented as Effect.Service with `createCheckoutSession`, `retrieveSubscription`, `verifyWebhookSignature`
- [ ] `FirestoreService` implemented as Effect.Service with `getUser`, `setUser`, `getMembership`, `setMembership`, `getPlans`
- [ ] `MembershipService` implemented as business logic layer using `Effect.gen`
- [ ] Layers composed with `Layer.provide()` in `LiveLayer`
- [ ] All API routes use `Effect.runPromise(program.pipe(Effect.provide(LiveLayer)))`
- [ ] Error handling uses `Effect.catchTag` for granular responses
- [ ] No `throw` statements in service code - all errors use `Effect.fail`
- [ ] Webhook handler validates signature before processing
- [ ] All TypeScript types properly defined
- [ ] No TypeScript compilation errors (`pnpm tsc --noEmit`)

## Validation Commands

```bash
# Install dependencies
pnpm add stripe effect @effect/schema

# Verify TypeScript compilation
pnpm tsc --noEmit

# Full Next.js build
pnpm build

# Test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test checkout endpoint
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_1SWflzFmXLvhjtKwhFF4WM5Z","email":"test@example.com","successUrl":"http://localhost:3000/thanks","cancelUrl":"http://localhost:3000"}'

# Test membership status
curl http://localhost:3000/api/membership/USER_ID

# Test plans endpoint
curl http://localhost:3000/api/membership/plans
```

## Notes

### Dependencies to Add

```bash
pnpm add stripe effect @effect/schema
```

### Environment Variables Required

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Security Considerations

- **Webhook signature verification is critical** - handled by `StripeService.verifyWebhookSignature`
- **All server-side writes use Admin SDK** via `FirestoreService`
- **Never expose `STRIPE_SECRET_KEY` to the client**
- **Effect errors never expose internal details** - use tagged errors with safe messages

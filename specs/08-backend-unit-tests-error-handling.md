# Plan: Backend Unit Tests for Error Handling (Stripe + Firebase)

## Task Description
Add comprehensive unit tests for backend services handling membership creation, payments, and authentication using Vitest. The focus is on testing error handling and edge cases to ensure users are never left in broken states.

## Objective
Implement a complete test suite with 80%+ coverage on backend service functions, covering all error scenarios for Stripe payment handling, Firebase authentication, Firestore operations, and integration scenarios.

## Problem Statement
The backend services handling membership payments and authentication lack unit tests. Without proper test coverage:
- Error scenarios may leave users in inconsistent states
- Payment failures might not be handled gracefully
- Edge cases like duplicate payments or webhook failures are untested
- Database consistency after failures is unverified

## Solution Approach
Create a comprehensive test suite using Vitest with:
1. Mock implementations for Stripe SDK and Firebase Admin SDK
2. Effect-TS test layers that inject mock services
3. Structured test files mirroring the service architecture
4. Focus on error paths and edge cases
5. Database consistency verification after errors

## Relevant Files
Use these files to understand the services being tested:

- `src/lib/effect/stripe.service.ts` - Stripe operations (checkout, subscriptions, webhooks)
- `src/lib/effect/firestore.service.ts` - Firestore CRUD and transactions
- `src/lib/effect/auth.service.ts` - Firebase Auth operations
- `src/lib/effect/membership.service.ts` - Membership orchestration
- `src/lib/effect/webhook-idempotency.service.ts` - Duplicate webhook prevention
- `src/lib/effect/portal.service.ts` - Customer portal operations
- `src/lib/effect/errors.ts` - Tagged error definitions
- `src/lib/effect/layers.ts` - Service layer composition
- `src/lib/effect/schemas.ts` - Type definitions
- `app/api/webhooks/stripe/route.ts` - Webhook handler implementation

### New Files
- `vitest.config.ts` - Vitest configuration
- `src/__tests__/setup.ts` - Global test setup
- `src/__tests__/mocks/stripe.mock.ts` - Stripe SDK mock
- `src/__tests__/mocks/firebase-admin.mock.ts` - Firebase Admin mock
- `src/__tests__/mocks/firestore.mock.ts` - Firestore mock helpers
- `src/__tests__/layers/test-layers.ts` - Effect-TS test layers
- `src/__tests__/services/stripe.service.test.ts` - Stripe service tests
- `src/__tests__/services/firestore.service.test.ts` - Firestore service tests
- `src/__tests__/services/auth.service.test.ts` - Auth service tests
- `src/__tests__/services/membership.service.test.ts` - Membership service tests
- `src/__tests__/services/webhook-idempotency.service.test.ts` - Idempotency tests
- `src/__tests__/services/portal.service.test.ts` - Portal service tests
- `src/__tests__/integration/checkout-flow.test.ts` - End-to-end checkout tests
- `src/__tests__/integration/webhook-processing.test.ts` - Webhook flow tests

## Implementation Phases

### Phase 1: Foundation
- Install Vitest and required testing dependencies
- Configure Vitest for TypeScript and path aliases
- Create mock infrastructure for external services
- Set up Effect-TS test layers

### Phase 2: Core Implementation
- Write unit tests for each service
- Cover all error scenarios per service
- Test error propagation and type safety
- Verify error messages and codes

### Phase 3: Integration & Polish
- Write integration tests for multi-service flows
- Test database consistency scenarios
- Add coverage reporting
- Document test patterns for future use

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Install Testing Dependencies
- Add Vitest and related packages: `vitest`, `@vitest/coverage-v8`
- Add testing utilities: `vitest-mock-extended` for type-safe mocks
- No additional Firebase/Stripe testing libs needed (use manual mocks)

```bash
pnpm add -D vitest @vitest/coverage-v8 vitest-mock-extended
```

### 2. Configure Vitest
- Create `vitest.config.ts` at project root
- Configure path aliases to match `tsconfig.json`
- Set up coverage thresholds (80% target)
- Configure test environment for Node.js

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/effect/**/*.ts"],
      exclude: ["src/lib/effect/client-*.ts", "**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/src": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 3. Create Global Test Setup
- Create `src/__tests__/setup.ts`
- Set up environment variables for tests
- Configure global mocks

```typescript
// src/__tests__/setup.ts
import { vi } from "vitest";

// Set test environment variables
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";
process.env.STRIPE_PRICE_INDIVIDUAL = "price_individual_test";
process.env.STRIPE_PRICE_FAMILY = "price_family_test";
process.env.GOOGLE_PROJECT_ID = "test-project";
process.env.GOOGLE_CLIENT_EMAIL = "test@test.iam.gserviceaccount.com";
process.env.GOOGLE_PRIVATE_KEY = "test-private-key";

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 4. Create Stripe Mock
- Create `src/__tests__/mocks/stripe.mock.ts`
- Mock Stripe client methods
- Create helpers for simulating errors

```typescript
// src/__tests__/mocks/stripe.mock.ts
import { vi } from "vitest";
import type Stripe from "stripe";

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
  type: "card_error" | "invalid_request_error" | "api_error",
  code: string,
  message: string
): Stripe.errors.StripeError => {
  const error = new Error(message) as Stripe.errors.StripeError;
  error.type = type;
  error.code = code;
  return error;
};

export const cardDeclinedError = () =>
  createStripeError("card_error", "card_declined", "Your card was declined.");

export const insufficientFundsError = () =>
  createStripeError("card_error", "insufficient_funds", "Insufficient funds.");

export const invalidSignatureError = () =>
  createStripeError(
    "invalid_request_error",
    "webhook_signature_verification_failed",
    "Invalid signature"
  );
```

### 5. Create Firebase Admin Mock
- Create `src/__tests__/mocks/firebase-admin.mock.ts`
- Mock Firebase Auth methods
- Create error helpers for auth errors

```typescript
// src/__tests__/mocks/firebase-admin.mock.ts
import { vi } from "vitest";

export const createMockAuth = () => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  getUser: vi.fn(),
  setCustomUserClaims: vi.fn(),
});

// Firebase Auth error codes
export type FirebaseAuthErrorCode =
  | "auth/email-already-in-use"
  | "auth/weak-password"
  | "auth/invalid-email"
  | "auth/id-token-expired"
  | "auth/id-token-revoked"
  | "auth/session-cookie-expired"
  | "auth/session-cookie-revoked"
  | "auth/user-not-found";

export const createAuthError = (code: FirebaseAuthErrorCode, message: string) => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

export const emailInUseError = () =>
  createAuthError("auth/email-already-in-use", "Email already in use");

export const weakPasswordError = () =>
  createAuthError("auth/weak-password", "Password is too weak");

export const tokenExpiredError = () =>
  createAuthError("auth/id-token-expired", "ID token has expired");

export const sessionRevokedError = () =>
  createAuthError("auth/session-cookie-revoked", "Session has been revoked");
```

### 6. Create Firestore Mock
- Create `src/__tests__/mocks/firestore.mock.ts`
- Mock Firestore operations and transactions
- Create helpers for simulating errors

```typescript
// src/__tests__/mocks/firestore.mock.ts
import { vi } from "vitest";

// In-memory document store for tests
export class MockFirestoreStore {
  private data: Map<string, Map<string, any>> = new Map();

  collection(name: string) {
    if (!this.data.has(name)) {
      this.data.set(name, new Map());
    }
    return this.data.get(name)!;
  }

  clear() {
    this.data.clear();
  }

  setDoc(collection: string, id: string, data: any) {
    this.collection(collection).set(id, { id, ...data });
  }

  getDoc(collection: string, id: string) {
    return this.collection(collection).get(id) || null;
  }

  deleteDoc(collection: string, id: string) {
    this.collection(collection).delete(id);
  }
}

export const createMockFirestore = () => {
  const store = new MockFirestoreStore();

  const mockDoc = (collectionPath: string) => ({
    get: vi.fn().mockImplementation(async () => ({
      exists: store.getDoc(collectionPath.split("/")[0], collectionPath.split("/")[1]) !== null,
      data: () => store.getDoc(collectionPath.split("/")[0], collectionPath.split("/")[1]),
      id: collectionPath.split("/")[1],
    })),
    set: vi.fn().mockImplementation(async (data: any) => {
      const parts = collectionPath.split("/");
      store.setDoc(parts[0], parts[1], data);
    }),
    update: vi.fn(),
    delete: vi.fn(),
    collection: (name: string) => createMockCollection(`${collectionPath}/${name}`),
  });

  const createMockCollection = (path: string) => ({
    doc: (id: string) => mockDoc(`${path}/${id}`),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(),
    add: vi.fn(),
  });

  return {
    collection: vi.fn((name: string) => createMockCollection(name)),
    collectionGroup: vi.fn(),
    runTransaction: vi.fn(),
    batch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(),
    })),
    _store: store,
  };
};

// Error factories
export const createFirestoreError = (
  code: "permission-denied" | "unavailable" | "not-found" | "already-exists",
  message: string
) => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

export const permissionDeniedError = () =>
  createFirestoreError("permission-denied", "Missing or insufficient permissions.");

export const networkError = () =>
  createFirestoreError("unavailable", "Service unavailable.");
```

### 7. Create Effect-TS Test Layers
- Create `src/__tests__/layers/test-layers.ts`
- Build test versions of each service
- Allow injecting mock behaviors

```typescript
// src/__tests__/layers/test-layers.ts
import { Context, Effect, Layer } from "effect";
import { vi } from "vitest";
import type { StripeService } from "@/src/lib/effect/stripe.service";
import type { FirestoreService } from "@/src/lib/effect/firestore.service";
import type { AuthService } from "@/src/lib/effect/auth.service";
import type { WebhookIdempotencyService } from "@/src/lib/effect/webhook-idempotency.service";
import {
  StripeService as StripeTag,
  FirestoreService as FirestoreTag,
  AuthService as AuthTag,
  WebhookIdempotencyService as WebhookTag,
} from "@/src/lib/effect/stripe.service";

// Test service implementations with controllable behavior
export const createTestStripeService = (overrides: Partial<StripeService> = {}): StripeService => ({
  createCheckoutSession: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  retrieveSubscription: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  verifyWebhookSignature: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  getCustomer: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  createPortalSession: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  getPricesWithProducts: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  addInvoiceItem: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  ...overrides,
});

export const createTestFirestoreService = (
  overrides: Partial<FirestoreService> = {}
): FirestoreService => ({
  getUser: vi.fn(() => Effect.succeed(null)),
  getUserByEmail: vi.fn(() => Effect.succeed(null)),
  getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
  setUser: vi.fn(() => Effect.succeed(undefined)),
  getMembership: vi.fn(() => Effect.succeed(null)),
  getActiveMembership: vi.fn(() => Effect.succeed(null)),
  setMembership: vi.fn(() => Effect.succeed(undefined)),
  updateMembership: vi.fn(() => Effect.succeed(undefined)),
  upsertUserByStripeCustomer: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  deleteMembership: vi.fn(() => Effect.succeed(undefined)),
  getNextMembershipNumber: vi.fn(() => Effect.succeed("DEC-2025-000001")),
  getMembershipCard: vi.fn(() => Effect.succeed(null)),
  setMembershipCard: vi.fn(() => Effect.succeed(undefined)),
  getMembershipByNumber: vi.fn(() => Effect.succeed(null)),
  getAllMemberships: vi.fn(() => Effect.succeed({ members: [], total: 0 })),
  getStats: vi.fn(() => Effect.succeed(null)),
  updateStats: vi.fn(() => Effect.succeed(undefined)),
  logAuditEntry: vi.fn(() => Effect.succeed(undefined)),
  ...overrides,
});

export const createTestAuthService = (overrides: Partial<AuthService> = {}): AuthService => ({
  verifyIdToken: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  createSessionCookie: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  verifySessionCookie: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  revokeRefreshTokens: vi.fn(() => Effect.succeed(undefined)),
  getUser: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  setCustomClaims: vi.fn(() => Effect.succeed(undefined)),
  getCustomClaims: vi.fn(() => Effect.succeed({ admin: false })),
  verifyAdminClaim: vi.fn(() => Effect.fail(new Error("Not mocked"))),
  ...overrides,
});

export const createTestWebhookService = (
  overrides: Partial<WebhookIdempotencyService> = {}
): WebhookIdempotencyService => ({
  checkEvent: vi.fn(() => Effect.succeed(null)),
  claimEvent: vi.fn(() => Effect.succeed(undefined)),
  completeEvent: vi.fn(() => Effect.succeed(undefined)),
  failEvent: vi.fn(() => Effect.succeed(undefined)),
  cleanupOldEvents: vi.fn(() => Effect.succeed(0)),
  ...overrides,
});

// Layer builders
export const TestStripeLayer = (service: StripeService) =>
  Layer.succeed(StripeTag, service);

export const TestFirestoreLayer = (service: FirestoreService) =>
  Layer.succeed(FirestoreTag, service);

export const TestAuthLayer = (service: AuthService) =>
  Layer.succeed(AuthTag, service);

export const TestWebhookLayer = (service: WebhookIdempotencyService) =>
  Layer.succeed(WebhookTag, service);
```

### 8. Write Stripe Service Tests
- Create `src/__tests__/services/stripe.service.test.ts`
- Test all error scenarios for Stripe operations

```typescript
// Test cases to implement:
describe("StripeService", () => {
  describe("createCheckoutSession", () => {
    it("should fail with ValidationError for invalid price ID");
    it("should fail with ValidationError when neither userId nor email provided");
    it("should fail with StripeError on network failure");
    it("should fail with StripeError on invalid parameters");
    it("should calculate processing fee when coverFees is true");
    it("should create session successfully with valid parameters");
  });

  describe("verifyWebhookSignature", () => {
    it("should fail with StripeError when webhook secret not configured");
    it("should fail with StripeError on invalid signature");
    it("should fail with StripeError on expired timestamp");
    it("should return event on valid signature");
  });

  describe("retrieveSubscription", () => {
    it("should fail with StripeError when subscription not found");
    it("should fail with StripeError on network error");
    it("should return subscription on success");
  });

  describe("createPortalSession", () => {
    it("should fail with StripeError when customer not found");
    it("should fail with StripeError on network error");
    it("should return portal session on success");
  });
});
```

### 9. Write Firestore Service Tests
- Create `src/__tests__/services/firestore.service.test.ts`
- Test all error scenarios for Firestore operations

```typescript
// Test cases to implement:
describe("FirestoreService", () => {
  describe("getUser", () => {
    it("should return null when user not found");
    it("should fail with FirestoreError on permission denied");
    it("should fail with FirestoreError on network error");
    it("should return user document on success");
  });

  describe("setUser", () => {
    it("should fail with FirestoreError on permission denied");
    it("should fail with FirestoreError on network error");
    it("should merge data when merge=true");
    it("should overwrite data when merge=false");
  });

  describe("getNextMembershipNumber", () => {
    it("should fail with FirestoreError on transaction conflict");
    it("should initialize counter if not exists");
    it("should increment counter atomically");
    it("should format number correctly (DEC-YYYY-NNNNNN)");
  });

  describe("upsertUserByStripeCustomer", () => {
    it("should update existing user found by stripeCustomerId");
    it("should link Stripe customer to user found by email");
    it("should create new user if not found");
    it("should fail with FirestoreError on network error");
  });

  describe("getActiveMembership", () => {
    it("should return null when no memberships exist");
    it("should return active membership with latest endDate");
    it("should handle Firestore index errors with fallback");
    it("should filter by active statuses only");
  });
});
```

### 10. Write Auth Service Tests
- Create `src/__tests__/services/auth.service.test.ts`
- Test all error scenarios for authentication

```typescript
// Test cases to implement:
describe("AuthService", () => {
  describe("verifyIdToken", () => {
    it("should fail with AuthError on expired token");
    it("should fail with AuthError on invalid token");
    it("should fail with AuthError on revoked token");
    it("should return decoded token on success");
  });

  describe("createSessionCookie", () => {
    it("should fail with AuthError on invalid token");
    it("should fail with AuthError on network error");
    it("should return session cookie on success");
  });

  describe("verifySessionCookie", () => {
    it("should fail with SessionError on expired session");
    it("should fail with SessionError on revoked session");
    it("should fail with SessionError on invalid session");
    it("should return decoded token on valid session");
  });

  describe("getUser", () => {
    it("should fail with AuthError when user not found");
    it("should return user record on success");
  });

  describe("verifyAdminClaim", () => {
    it("should return isAdmin=false when no admin claim");
    it("should return isAdmin=true when admin claim exists");
    it("should fail with SessionError on invalid session");
  });
});
```

### 11. Write Membership Service Tests
- Create `src/__tests__/services/membership.service.test.ts`
- Test orchestration and error handling

```typescript
// Test cases to implement:
describe("MembershipService", () => {
  describe("createCheckoutSession", () => {
    it("should look up existing user when userId provided");
    it("should use email directly when no userId");
    it("should pass stripeCustomerId to Stripe if user has one");
    it("should propagate StripeError from Stripe service");
    it("should propagate FirestoreError from user lookup");
  });

  describe("processCheckoutCompleted", () => {
    it("should skip membership creation for incomplete subscription");
    it("should skip membership creation for incomplete_expired subscription");
    it("should fail with StripeError when subscription retrieval fails");
    it("should create user if not exists");
    it("should link to existing user by email");
    it("should create membership with correct dates");
    it("should add processing fee invoice item when present");
  });

  describe("processSubscriptionUpdated", () => {
    it("should log warning and return when user not found");
    it("should update membership status");
    it("should update membership dates");
    it("should update autoRenew based on cancel_at_period_end");
  });

  describe("processSubscriptionDeleted", () => {
    it("should log warning and return when user not found");
    it("should mark membership as canceled");
    it("should set autoRenew to false");
  });

  describe("getMembershipStatus", () => {
    it("should fail with NotFoundError when user not found");
    it("should return isActive=false when no membership");
    it("should return correct status for active membership");
    it("should format dates correctly");
  });

  describe("getPlans", () => {
    it("should fail with StripeError when prices fetch fails");
    it("should map price IDs to benefits correctly");
    it("should convert cents to dollars");
  });
});
```

### 12. Write Webhook Idempotency Service Tests
- Create `src/__tests__/services/webhook-idempotency.service.test.ts`
- Test duplicate handling and race conditions

```typescript
// Test cases to implement:
describe("WebhookIdempotencyService", () => {
  describe("claimEvent", () => {
    it("should claim new event successfully");
    it("should fail with DuplicateWebhookError for completed event");
    it("should allow retry for failed event");
    it("should reclaim stale processing event (>5 min)");
    it("should reject recent processing event as duplicate");
    it("should increment retryCount on reclaim");
    it("should fail with FirestoreError on transaction failure");
  });

  describe("completeEvent", () => {
    it("should mark event as completed");
    it("should set completedAt timestamp");
    it("should fail with FirestoreError on network error");
  });

  describe("failEvent", () => {
    it("should mark event as failed");
    it("should store error message");
    it("should set failedAt timestamp");
  });

  describe("cleanupOldEvents", () => {
    it("should delete events older than threshold");
    it("should return count of deleted events");
    it("should handle empty result");
  });
});
```

### 13. Write Portal Service Tests
- Create `src/__tests__/services/portal.service.test.ts`
- Test session and dashboard operations

```typescript
// Test cases to implement:
describe("PortalService", () => {
  describe("verifySession", () => {
    it("should fail with SessionError on invalid session");
    it("should return uid and email on valid session");
  });

  describe("getMemberDashboard", () => {
    it("should fail with NotFoundError when user not found");
    it("should return null membership when no active membership");
    it("should calculate daysRemaining correctly");
    it("should set canManageSubscription based on stripeCustomerId");
  });

  describe("createPortalSession", () => {
    it("should fail with NotFoundError when user not found");
    it("should fail with NotFoundError when no stripeCustomerId");
    it("should fail with StripeError when portal creation fails");
    it("should return portal URL on success");
  });
});
```

### 14. Write Integration Tests - Checkout Flow
- Create `src/__tests__/integration/checkout-flow.test.ts`
- Test complete checkout scenarios

```typescript
// Test cases to implement:
describe("Checkout Flow Integration", () => {
  describe("successful checkout", () => {
    it("should create checkout session with user data");
    it("should process webhook and create membership");
    it("should update stats after successful checkout");
  });

  describe("payment failure scenarios", () => {
    it("should not create membership on card_declined");
    it("should not create membership on insufficient_funds");
    it("should leave user in consistent state after payment failure");
  });

  describe("Firestore failure during checkout", () => {
    it("should handle user lookup failure gracefully");
    it("should fail checkout if Firestore write fails after payment");
  });

  describe("partial failure recovery", () => {
    it("should allow retry when membership creation fails");
    it("should detect and handle duplicate payment via idempotency");
  });
});
```

### 15. Write Integration Tests - Webhook Processing
- Create `src/__tests__/integration/webhook-processing.test.ts`
- Test webhook handling edge cases

```typescript
// Test cases to implement:
describe("Webhook Processing Integration", () => {
  describe("signature verification", () => {
    it("should return 400 on missing signature header");
    it("should return 400 on invalid signature");
    it("should return 400 on expired timestamp");
  });

  describe("idempotency handling", () => {
    it("should process new event successfully");
    it("should return 200 for duplicate event (no reprocessing)");
    it("should retry failed events");
  });

  describe("checkout.session.completed", () => {
    it("should create membership for active subscription");
    it("should skip membership for incomplete subscription");
    it("should add processing fee when metadata present");
    it("should create membership card after checkout");
    it("should update stats after checkout");
  });

  describe("customer.subscription.updated", () => {
    it("should update membership status");
    it("should handle unknown customer gracefully");
  });

  describe("customer.subscription.deleted", () => {
    it("should mark membership as canceled");
    it("should update stats for cancellation");
  });

  describe("error recovery", () => {
    it("should mark event as failed on processing error");
    it("should allow retry on next webhook delivery");
    it("should not duplicate membership on retry");
  });
});
```

### 16. Add npm Scripts and Documentation
- Update `package.json` with test scripts
- Add coverage script
- Document test patterns

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

## Testing Strategy

### Unit Test Approach
- Each service method gets isolated tests
- Mock all dependencies using Effect-TS test layers
- Verify error types using Effect's `_tag` discrimination
- Check error messages and codes match expected values

### Integration Test Approach
- Test multi-service flows using combined test layers
- Verify database consistency after operations
- Test rollback/recovery scenarios
- Verify statistics updates

### Coverage Goals
- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 75% minimum (error paths may have uncovered positive cases initially)
- **Statements**: 80% minimum

### Test Isolation
- Each test gets fresh mock instances
- Use `beforeEach` to reset all mocks
- In-memory Firestore store clears between tests
- No shared state between test files

## Acceptance Criteria
- [ ] Vitest configured and running
- [ ] All service files have corresponding test files
- [ ] Each error type in `errors.ts` has at least one test triggering it
- [ ] Stripe error scenarios tested: card_declined, insufficient_funds, invalid signature, network errors
- [ ] Firebase Auth error scenarios tested: expired token, revoked session, user not found
- [ ] Firestore error scenarios tested: permission denied, network errors, transaction conflicts
- [ ] Webhook idempotency tested: duplicate prevention, retry handling, stale lock reclaim
- [ ] Integration tests verify database consistency after failures
- [ ] Coverage report shows 80%+ on service files
- [ ] All tests pass with `pnpm test:run`

## Validation Commands
Execute these commands to validate the task is complete:

- `pnpm test:run` - Run all tests (should pass)
- `pnpm test:coverage` - Generate coverage report (should show 80%+)
- `pnpm tsc` - Type check passes with test files

## Notes
- Vitest is used instead of Jest per user request
- Effect-TS services use `Effect.runPromise` in tests for assertion
- Mock services return `Effect.succeed` or `Effect.fail` to control behavior
- Use `vitest-mock-extended` for type-safe mock assertions
- Focus on error paths that could leave users in broken states
- Stripe API mocks don't need to match exact API shapes - only what services use

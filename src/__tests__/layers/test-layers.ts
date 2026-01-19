import {Effect, Layer} from 'effect';
import {vi} from 'vitest';

import {AdminService, type AdminService as AdminServiceType} from '@/src/lib/effect/admin.service';
import {AuthService, type AuthService as AuthServiceType} from '@/src/lib/effect/auth.service';
import {NotFoundError} from '@/src/lib/effect/errors';
import {
  FirestoreService,
  type FirestoreService as FirestoreServiceType,
} from '@/src/lib/effect/firestore.service';
import {
  MembershipService,
  type MembershipService as MembershipServiceType,
} from '@/src/lib/effect/membership.service';
import {
  PortalService,
  type PortalService as PortalServiceType,
} from '@/src/lib/effect/portal.service';
import {
  StripeService,
  type StripeService as StripeServiceType,
} from '@/src/lib/effect/stripe.service';
import {
  WebhookIdempotencyService,
  type WebhookIdempotencyService as WebhookIdempotencyServiceType,
} from '@/src/lib/effect/webhook-idempotency.service';

// Test service implementations with controllable behavior
export const createTestStripeService = (
  overrides: Partial<StripeServiceType> = {},
): StripeServiceType => ({
  createCheckoutSession: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['createCheckoutSession'],
  retrieveSubscription: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['retrieveSubscription'],
  verifyWebhookSignature: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['verifyWebhookSignature'],
  getCustomer: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['getCustomer'],
  createPortalSession: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['createPortalSession'],
  getPricesWithProducts: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['getPricesWithProducts'],
  addInvoiceItem: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as StripeServiceType['addInvoiceItem'],
  getCustomerByEmail: vi.fn(() => Effect.succeed(null)),
  listCustomerSubscriptions: vi.fn(() => Effect.succeed([])),
  ...overrides,
});

export const createTestFirestoreService = (
  overrides: Partial<FirestoreServiceType> = {},
): FirestoreServiceType => ({
  getUser: vi.fn(() => Effect.succeed(null)),
  getUserByEmail: vi.fn(() => Effect.succeed(null)),
  getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
  setUser: vi.fn(() => Effect.succeed(undefined)),
  getMembership: vi.fn(() => Effect.succeed(null)),
  getActiveMembership: vi.fn(() => Effect.succeed(null)),
  setMembership: vi.fn(() => Effect.succeed(undefined)),
  updateMembership: vi.fn(() => Effect.succeed(undefined)),
  upsertUserByStripeCustomer: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as FirestoreServiceType['upsertUserByStripeCustomer'],
  deleteMembership: vi.fn(() => Effect.succeed(undefined)),
  getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2025-000001')),
  getMembershipCard: vi.fn(() => Effect.succeed(null)),
  setMembershipCard: vi.fn(() => Effect.succeed(undefined)),
  updateMembershipCard: vi.fn(() => Effect.succeed(undefined)),
  getMembershipByNumber: vi.fn(() => Effect.succeed(null)),
  getAllMemberships: vi.fn(() => Effect.succeed({members: [], total: 0})),
  getStats: vi.fn(() => Effect.succeed(null)),
  updateStats: vi.fn(() => Effect.succeed(undefined)),
  logAuditEntry: vi.fn(() => Effect.succeed(undefined)),
  ...overrides,
});

export const createTestAuthService = (
  overrides: Partial<AuthServiceType> = {},
): AuthServiceType => ({
  verifyIdToken: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AuthServiceType['verifyIdToken'],
  createSessionCookie: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AuthServiceType['createSessionCookie'],
  verifySessionCookie: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AuthServiceType['verifySessionCookie'],
  revokeRefreshTokens: vi.fn(() => Effect.succeed(undefined)),
  getUser: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AuthServiceType['getUser'],
  setCustomClaims: vi.fn(() => Effect.succeed(undefined)),
  getCustomClaims: vi.fn(() => Effect.succeed({admin: false})),
  verifyAdminClaim: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AuthServiceType['verifyAdminClaim'],
  ...overrides,
});

export const createTestWebhookService = (
  overrides: Partial<WebhookIdempotencyServiceType> = {},
): WebhookIdempotencyServiceType => ({
  checkEvent: vi.fn(() => Effect.succeed(null)),
  claimEvent: vi.fn(() => Effect.succeed(undefined)),
  completeEvent: vi.fn(() => Effect.succeed(undefined)),
  failEvent: vi.fn(() => Effect.succeed(undefined)),
  cleanupOldEvents: vi.fn(() => Effect.succeed(0)),
  ...overrides,
});

export const createTestMembershipService = (
  overrides: Partial<MembershipServiceType> = {},
): MembershipServiceType => ({
  createCheckoutSession: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as MembershipServiceType['createCheckoutSession'],
  processCheckoutCompleted: vi.fn(() => Effect.succeed(undefined)),
  processSubscriptionUpdated: vi.fn(() => Effect.succeed(undefined)),
  processSubscriptionDeleted: vi.fn(() => Effect.succeed(undefined)),
  getMembershipStatus: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as MembershipServiceType['getMembershipStatus'],
  getPlans: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as MembershipServiceType['getPlans'],
  ...overrides,
});

export const createTestPortalService = (
  overrides: Partial<PortalServiceType> = {},
): PortalServiceType => ({
  verifySession: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as PortalServiceType['verifySession'],
  getMemberDashboard: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as PortalServiceType['getMemberDashboard'],
  createPortalSession: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as PortalServiceType['createPortalSession'],
  linkFirebaseToStripe: vi.fn(() => Effect.succeed(undefined)),
  ...overrides,
});

export const createTestAdminService = (
  overrides: Partial<AdminServiceType> = {},
): AdminServiceType => ({
  verifyAdmin: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AdminServiceType['verifyAdmin'],
  setAdminRole: vi.fn(() => Effect.succeed(undefined)),
  searchMembers: vi.fn(() => Effect.succeed({members: [], total: 0})),
  getMember: vi.fn(() =>
    Effect.fail(new NotFoundError({resource: 'user', id: ''})),
  ) as unknown as AdminServiceType['getMember'],
  adjustMembership: vi.fn(() => Effect.succeed(undefined)),
  validateStripeVsFirebase: vi.fn(() =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AdminServiceType['validateStripeVsFirebase'],
  reconcileMembership: vi.fn((_email: string, _adminUid?: string) =>
    Effect.fail(new Error('Not mocked')),
  ) as unknown as AdminServiceType['reconcileMembership'],
  ...overrides,
});

// Layer builders
export const TestStripeLayer = (service: StripeServiceType) =>
  Layer.succeed(StripeService, service);

export const TestFirestoreLayer = (service: FirestoreServiceType) =>
  Layer.succeed(FirestoreService, service);

export const TestAuthLayer = (service: AuthServiceType) => Layer.succeed(AuthService, service);

export const TestWebhookLayer = (service: WebhookIdempotencyServiceType) =>
  Layer.succeed(WebhookIdempotencyService, service);

export const TestMembershipLayer = (service: MembershipServiceType) =>
  Layer.succeed(MembershipService, service);

export const TestPortalLayer = (service: PortalServiceType) =>
  Layer.succeed(PortalService, service);

export const TestAdminLayer = (service: AdminServiceType) =>
  Layer.succeed(AdminService, service);

// Combined test layer builder for integration tests
export const createTestLayers = (services: {
  stripe?: Partial<StripeServiceType>;
  firestore?: Partial<FirestoreServiceType>;
  auth?: Partial<AuthServiceType>;
  webhook?: Partial<WebhookIdempotencyServiceType>;
}) => {
  const stripeService = createTestStripeService(services.stripe);
  const firestoreService = createTestFirestoreService(services.firestore);
  const authService = createTestAuthService(services.auth);
  const webhookService = createTestWebhookService(services.webhook);

  return Layer.mergeAll(
    TestStripeLayer(stripeService),
    TestFirestoreLayer(firestoreService),
    TestAuthLayer(authService),
    TestWebhookLayer(webhookService),
  );
};

// Helper to run Effect with test layer and extract result or error
export const runTest = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.runPromise(effect);

export const runTestExit = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromiseExit(effect);

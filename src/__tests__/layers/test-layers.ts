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
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['createCheckoutSession'],
  retrieveSubscription: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['retrieveSubscription'],
  verifyWebhookSignature: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['verifyWebhookSignature'],
  getCustomer: vi.fn(() => Effect.die('Not mocked')) as unknown as StripeServiceType['getCustomer'],
  createPortalSession: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['createPortalSession'],
  getPricesWithProducts: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['getPricesWithProducts'],
  addInvoiceItem: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['addInvoiceItem'],
  getCustomerByEmail: vi.fn(() => Effect.succeed(null)),
  listCustomerSubscriptions: vi.fn(() => Effect.succeed([])),
  cancelSubscription: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['cancelSubscription'],
  updateCustomerEmail: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['updateCustomerEmail'],
  getPaymentHistory: vi.fn(() => Effect.succeed([])),
  createRefund: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['createRefund'],
  createCustomer: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as StripeServiceType['createCustomer'],
  ...overrides,
});

export const createTestFirestoreService = (
  overrides: Partial<FirestoreServiceType> = {},
): FirestoreServiceType => ({
  getUser: vi.fn(() => Effect.succeed(null)),
  getUserByEmail: vi.fn(() => Effect.succeed(null)),
  getUserByStripeCustomerId: vi.fn(() => Effect.succeed(null)),
  setUser: vi.fn(() => Effect.void),
  createUser: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as FirestoreServiceType['createUser'],
  updateUser: vi.fn(() => Effect.void),
  getMembership: vi.fn(() => Effect.succeed(null)),
  getActiveMembership: vi.fn(() => Effect.succeed(null)),
  setMembership: vi.fn(() => Effect.void),
  updateMembership: vi.fn(() => Effect.void),
  upsertUserByStripeCustomer: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as FirestoreServiceType['upsertUserByStripeCustomer'],
  deleteMembership: vi.fn(() => Effect.void),
  getNextMembershipNumber: vi.fn(() => Effect.succeed('DEC-2025-000001')),
  getMembershipCard: vi.fn(() => Effect.succeed(null)),
  setMembershipCard: vi.fn(() => Effect.void),
  updateMembershipCard: vi.fn(() => Effect.void),
  getMembershipByNumber: vi.fn(() => Effect.succeed(null)),
  getAllMemberships: vi.fn(() => Effect.succeed({members: [], total: 0})),
  getStats: vi.fn(() => Effect.succeed(null)),
  updateStats: vi.fn(() => Effect.void),
  logAuditEntry: vi.fn(() => Effect.void),
  getMemberAuditLog: vi.fn(() => Effect.succeed([])),
  getExpiringMemberships: vi.fn(() => Effect.succeed([])),
  softDeleteMember: vi.fn(() => Effect.void),
  getAllUsers: vi.fn(() => Effect.succeed([])),
  ...overrides,
});

export const createTestAuthService = (
  overrides: Partial<AuthServiceType> = {},
): AuthServiceType => ({
  verifyIdToken: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AuthServiceType['verifyIdToken'],
  createSessionCookie: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AuthServiceType['createSessionCookie'],
  verifySessionCookie: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AuthServiceType['verifySessionCookie'],
  revokeRefreshTokens: vi.fn(() => Effect.void),
  getUser: vi.fn(() => Effect.die('Not mocked')) as unknown as AuthServiceType['getUser'],
  setCustomClaims: vi.fn(() => Effect.void),
  getCustomClaims: vi.fn(() => Effect.succeed({admin: false})),
  verifyAdminClaim: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AuthServiceType['verifyAdminClaim'],
  updateUserEmail: vi.fn(() => Effect.void),
  createAuthUser: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AuthServiceType['createAuthUser'],
  getUserByEmail: vi.fn(() => Effect.succeed(null)),
  deleteUser: vi.fn(() => Effect.void),
  ...overrides,
});

export const createTestWebhookService = (
  overrides: Partial<WebhookIdempotencyServiceType> = {},
): WebhookIdempotencyServiceType => ({
  checkEvent: vi.fn(() => Effect.succeed(null)),
  claimEvent: vi.fn(() => Effect.void),
  completeEvent: vi.fn(() => Effect.void),
  failEvent: vi.fn(() => Effect.void),
  cleanupOldEvents: vi.fn(() => Effect.succeed(0)),
  ...overrides,
});

export const createTestMembershipService = (
  overrides: Partial<MembershipServiceType> = {},
): MembershipServiceType => ({
  createCheckoutSession: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as MembershipServiceType['createCheckoutSession'],
  processCheckoutCompleted: vi.fn(() => Effect.void),
  processSubscriptionUpdated: vi.fn(() => Effect.void),
  processSubscriptionDeleted: vi.fn(() => Effect.void),
  getMembershipStatus: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as MembershipServiceType['getMembershipStatus'],
  getPlans: vi.fn(() => Effect.die('Not mocked')) as unknown as MembershipServiceType['getPlans'],
  ...overrides,
});

export const createTestPortalService = (
  overrides: Partial<PortalServiceType> = {},
): PortalServiceType => ({
  verifySession: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as PortalServiceType['verifySession'],
  getMemberDashboard: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as PortalServiceType['getMemberDashboard'],
  createPortalSession: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as PortalServiceType['createPortalSession'],
  linkFirebaseToStripe: vi.fn(() => Effect.void),
  ...overrides,
});

export const createTestAdminService = (
  overrides: Partial<AdminServiceType> = {},
): AdminServiceType => ({
  verifyAdmin: vi.fn(() => Effect.die('Not mocked')) as unknown as AdminServiceType['verifyAdmin'],
  setAdminRole: vi.fn(() => Effect.void),
  searchMembers: vi.fn(() => Effect.succeed({members: [], total: 0})),
  getMember: vi.fn(() =>
    Effect.fail(new NotFoundError({resource: 'user', id: ''})),
  ) as unknown as AdminServiceType['getMember'],
  adjustMembership: vi.fn(() => Effect.void),
  validateStripeVsFirebase: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AdminServiceType['validateStripeVsFirebase'],
  reconcileMembership: vi.fn((_email: string, _adminUid?: string) =>
    Effect.die('Not mocked'),
  ) as unknown as AdminServiceType['reconcileMembership'],
  createMember: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AdminServiceType['createMember'],
  updateMember: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AdminServiceType['updateMember'],
  deleteMember: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AdminServiceType['deleteMember'],
  bulkImportMembers: vi.fn(() =>
    Effect.die('Not mocked'),
  ) as unknown as AdminServiceType['bulkImportMembers'],
  getExpiringMemberships: vi.fn(() => Effect.succeed([])),
  getMemberAuditLog: vi.fn(() => Effect.succeed([])),
  getPaymentHistory: vi.fn(() => Effect.succeed([])),
  issueRefund: vi.fn(() => Effect.die('Not mocked')) as unknown as AdminServiceType['issueRefund'],
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

export const TestAdminLayer = (service: AdminServiceType) => Layer.succeed(AdminService, service);

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

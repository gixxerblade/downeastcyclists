import type {
  UserDocument,
  MembershipDocument,
  MembershipCard,
  MembershipStats,
  WebhookEventDocument,
} from '@/src/lib/effect/schemas';

// Error factories for simulating database errors in tests
export const createDatabaseError = (
  code: 'permission-denied' | 'unavailable' | 'not-found' | 'already-exists' | 'aborted',
  message: string,
) => {
  const error = new Error(message) as Error & {code: string};
  error.code = code;
  return error;
};

export const permissionDeniedError = () =>
  createDatabaseError('permission-denied', 'Missing or insufficient permissions.');

export const networkError = () => createDatabaseError('unavailable', 'Service unavailable.');

export const notFoundError = () => createDatabaseError('not-found', 'Document not found.');

export const transactionConflictError = () =>
  createDatabaseError('aborted', 'Transaction conflict.');

// Mock Timestamp helper for tests that need date conversion utilities
export const createMockTimestamp = (date: Date = new Date()) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

// Mock data factories — dates are ISO strings to match Postgres/Drizzle output
export const createMockUserDocument = (overrides: Partial<UserDocument> = {}): UserDocument => ({
  id: 'user_123',
  email: 'test@example.com',
  name: 'Test User',
  stripeCustomerId: 'cus_test_123',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockMembershipDocument = (
  overrides: Partial<MembershipDocument> = {},
): MembershipDocument => ({
  id: 'sub_test_123',
  stripeSubscriptionId: 'sub_test_123',
  planType: 'individual',
  status: 'active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  autoRenew: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockMembershipCard = (
  overrides: Partial<MembershipCard> = {},
): MembershipCard => ({
  id: 'current',
  userId: 'user_123',
  membershipNumber: 'DEC-2025-000001',
  memberName: 'Test User',
  email: 'test@example.com',
  planType: 'individual',
  status: 'active',
  validFrom: new Date().toISOString(),
  validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  qrCodeData: 'test_qr_data',
  pdfUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockStats = (overrides: Partial<MembershipStats> = {}): MembershipStats => ({
  totalMembers: 100,
  activeMembers: 80,
  expiredMembers: 15,
  canceledMembers: 5,
  individualCount: 60,
  familyCount: 20,
  monthlyRevenue: 2500,
  yearlyRevenue: 30000,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockWebhookEvent = (
  overrides: Partial<WebhookEventDocument> = {},
): WebhookEventDocument => ({
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  processedAt: new Date().toISOString(),
  status: 'completed',
  retryCount: 0,
  ...overrides,
});

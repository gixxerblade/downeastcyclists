import {vi} from 'vitest';

import type {
  UserDocument,
  MembershipDocument,
  MembershipCard,
  MembershipStats,
  WebhookEventDocument,
} from '@/src/lib/effect/schemas';

// In-memory document store for tests
export class MockFirestoreStore {
  private data: Map<string, Map<string, unknown>> = new Map();

  collection(name: string) {
    if (!this.data.has(name)) {
      this.data.set(name, new Map());
    }
    const collection = this.data.get(name);
    if (!collection) {
      throw new Error(`Collection ${name} not found`);
    }
    return collection;
  }

  clear() {
    this.data.clear();
  }

  setDoc(collection: string, id: string, data: unknown) {
    this.collection(collection).set(id, {id, ...(data as object)});
  }

  getDoc(collection: string, id: string) {
    return this.collection(collection).get(id) || null;
  }

  deleteDoc(collection: string, id: string) {
    this.collection(collection).delete(id);
  }

  getAllDocs(collection: string) {
    return Array.from(this.collection(collection).values());
  }
}

export const createMockFirestore = () => {
  const store = new MockFirestoreStore();

  const mockDoc = (collectionPath: string) => ({
    get: vi.fn().mockImplementation(async () => ({
      exists: store.getDoc(collectionPath.split('/')[0], collectionPath.split('/')[1]) !== null,
      data: () => store.getDoc(collectionPath.split('/')[0], collectionPath.split('/')[1]),
      id: collectionPath.split('/')[1],
    })),
    set: vi.fn().mockImplementation(async (data: unknown) => {
      const parts = collectionPath.split('/');
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
  code: 'permission-denied' | 'unavailable' | 'not-found' | 'already-exists' | 'aborted',
  message: string,
) => {
  const error = new Error(message) as Error & {code: string};
  error.code = code;
  return error;
};

export const permissionDeniedError = () =>
  createFirestoreError('permission-denied', 'Missing or insufficient permissions.');

export const networkError = () => createFirestoreError('unavailable', 'Service unavailable.');

export const notFoundError = () => createFirestoreError('not-found', 'Document not found.');

export const transactionConflictError = () =>
  createFirestoreError('aborted', 'Transaction conflict.');

// Mock Firestore Timestamp
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

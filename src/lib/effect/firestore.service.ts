import {FieldValue, Timestamp} from '@google-cloud/firestore';
import {Context, Effect, Layer} from 'effect';

import {getFirestoreClient} from '@/src/lib/firestore-client';

import {FirestoreError} from './errors';
import type {
  UserDocument,
  MembershipDocument,
  MembershipCard,
  MembershipStats,
  MemberSearchParams,
  MemberWithMembership,
} from './schemas';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  MEMBERSHIPS: 'memberships',
} as const;

/**
 * Converts Firestore Timestamps to ISO date strings in an object
 * This ensures proper serialization when data is sent to the client
 */
function serializeTimestamps<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeTimestamps(item)) as T;
  }

  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if it's a Firestore Timestamp (has toDate method)
    if (
      value &&
      typeof value === 'object' &&
      'toDate' in value &&
      typeof value.toDate === 'function'
    ) {
      serialized[key] = value.toDate().toISOString();
    }
    // Check if it's a serialized timestamp (has _seconds)
    else if (
      value &&
      typeof value === 'object' &&
      '_seconds' in value &&
      typeof value._seconds === 'number'
    ) {
      serialized[key] = new Date((value._seconds as number) * 1000).toISOString();
    }
    // Recursively handle nested objects
    else if (value && typeof value === 'object') {
      serialized[key] = serializeTimestamps(value);
    } else {
      serialized[key] = value;
    }
  }

  return serialized as T;
}

// Audit entry type for query results
export interface AuditEntryDocument {
  id: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: FirebaseFirestore.Timestamp | Date | string;
}

// Service interface
export interface FirestoreService {
  readonly getUser: (userId: string) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly getUserByEmail: (email: string) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly createUser: (
    userId: string,
    data: Omit<UserDocument, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Effect.Effect<UserDocument, FirestoreError>;

  readonly updateUser: (
    userId: string,
    data: Partial<Omit<UserDocument, 'id' | 'createdAt'>>,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getUserByStripeCustomerId: (
    customerId: string,
  ) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly setUser: (
    userId: string,
    data: Partial<UserDocument>,
    merge?: boolean,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getMembership: (
    userId: string,
    membershipId: string,
  ) => Effect.Effect<MembershipDocument | null, FirestoreError>;

  readonly getActiveMembership: (
    userId: string,
  ) => Effect.Effect<MembershipDocument | null, FirestoreError>;

  readonly setMembership: (
    userId: string,
    membershipId: string,
    data: Omit<MembershipDocument, 'id'>,
  ) => Effect.Effect<void, FirestoreError>;

  readonly updateMembership: (
    userId: string,
    membershipId: string,
    data: Partial<MembershipDocument>,
  ) => Effect.Effect<void, FirestoreError>;

  readonly upsertUserByStripeCustomer: (
    stripeCustomerId: string,
    email: string,
    defaultData: Partial<UserDocument>,
  ) => Effect.Effect<UserDocument, FirestoreError>;

  readonly deleteMembership: (
    userId: string,
    membershipId: string,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getNextMembershipNumber: (year: number) => Effect.Effect<string, FirestoreError>;

  readonly getMembershipCard: (
    userId: string,
  ) => Effect.Effect<MembershipCard | null, FirestoreError>;

  readonly setMembershipCard: (
    userId: string,
    card: Omit<MembershipCard, 'id'>,
  ) => Effect.Effect<void, FirestoreError>;

  readonly updateMembershipCard: (
    userId: string,
    data: Partial<MembershipCard>,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getMembershipByNumber: (
    membershipNumber: string,
  ) => Effect.Effect<{userId: string; card: MembershipCard} | null, FirestoreError>;

  // Admin query methods
  readonly getAllMemberships: (
    params: MemberSearchParams,
  ) => Effect.Effect<{members: MemberWithMembership[]; total: number}, FirestoreError>;

  readonly getStats: () => Effect.Effect<MembershipStats | null, FirestoreError>;

  readonly updateStats: (stats: Partial<MembershipStats>) => Effect.Effect<void, FirestoreError>;

  readonly logAuditEntry: (
    userId: string,
    action: string,
    details: Record<string, unknown>,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getMemberAuditLog: (
    userId: string,
  ) => Effect.Effect<AuditEntryDocument[], FirestoreError>;

  readonly getExpiringMemberships: (
    withinDays: number,
  ) => Effect.Effect<MemberWithMembership[], FirestoreError>;

  readonly softDeleteMember: (
    userId: string,
    deletedBy: string,
    reason: string,
  ) => Effect.Effect<void, FirestoreError>;

  readonly getAllUsers: () => Effect.Effect<UserDocument[], FirestoreError>;
}

// Service tag
export const FirestoreService = Context.GenericTag<FirestoreService>('FirestoreService');

// Implementation
const make = Effect.sync(() => {
  const db = getFirestoreClient();

  return FirestoreService.of({
    getUser: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
          if (!doc.exists) return null;
          return {id: doc.id, ...doc.data()} as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_USER_FAILED',
            message: `Failed to get user ${userId}`,
            cause: error,
          }),
      }),

    getUserByEmail: (email) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.USERS)
            .where('email', '==', email)
            .limit(1)
            .get();
          if (snapshot.empty) return null;
          const doc = snapshot.docs[0];
          return {id: doc.id, ...doc.data()} as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_USER_BY_EMAIL_FAILED',
            message: `Failed to get user by email ${email}`,
            cause: error,
          }),
      }),

    getUserByStripeCustomerId: (customerId) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.USERS)
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
          if (snapshot.empty) return null;
          const doc = snapshot.docs[0];
          return {id: doc.id, ...doc.data()} as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_USER_BY_CUSTOMER_ID_FAILED',
            message: `Failed to get user by Stripe customer ID ${customerId}`,
            cause: error,
          }),
      }),

    setUser: (userId, data, merge = true) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .set(
              {
                ...data,
                updatedAt: FieldValue.serverTimestamp(),
              },
              {merge},
            ),
        catch: (error) =>
          new FirestoreError({
            code: 'SET_USER_FAILED',
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
          return {id: doc.id, ...doc.data()} as MembershipDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_MEMBERSHIP_FAILED',
            message: `Failed to get membership ${membershipId} for user ${userId}`,
            cause: error,
          }),
      }),

    getActiveMembership: (userId) =>
      Effect.tryPromise({
        try: async () => {
          try {
            // Try the indexed query first
            const snapshot = await db
              .collection(COLLECTIONS.USERS)
              .doc(userId)
              .collection(COLLECTIONS.MEMBERSHIPS)
              .where('status', 'in', ['active', 'trialing', 'past_due'])
              .orderBy('endDate', 'desc')
              .limit(1)
              .get();

            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              return {id: doc.id, ...doc.data()} as MembershipDocument;
            }
          } catch {
            // Fallback: get all memberships and filter in memory (handles missing index)
            const allMemberships = await db
              .collection(COLLECTIONS.USERS)
              .doc(userId)
              .collection(COLLECTIONS.MEMBERSHIPS)
              .get();

            if (allMemberships.empty) {
              return null;
            }

            // Filter and sort in memory
            const activeMemberships = allMemberships.docs
              .map((doc) => ({id: doc.id, ...doc.data()}) as MembershipDocument)
              .filter((m) => ['active', 'trialing', 'past_due'].includes(m.status))
              .sort((a, b) => {
                const aDate = a.endDate.toDate?.() || new Date(a.endDate as any);
                const bDate = b.endDate.toDate?.() || new Date(b.endDate as any);
                return bDate.getTime() - aDate.getTime();
              });

            if (activeMemberships.length > 0) {
              return activeMemberships[0];
            }

            return null;
          }

          return null;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_ACTIVE_MEMBERSHIP_FAILED',
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
            code: 'SET_MEMBERSHIP_FAILED',
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
            code: 'UPDATE_MEMBERSHIP_FAILED',
            message: `Failed to update membership ${membershipId} for user ${userId}`,
            cause: error,
          }),
      }),

    upsertUserByStripeCustomer: (stripeCustomerId, email, defaultData) =>
      Effect.tryPromise({
        try: async () => {
          // First try to find by Stripe customer ID
          let snapshot = await db
            .collection(COLLECTIONS.USERS)
            .where('stripeCustomerId', '==', stripeCustomerId)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            // Update email if changed
            if (email && doc.data().email !== email) {
              await doc.ref.update({email, updatedAt: FieldValue.serverTimestamp()});
            }
            return {id: doc.id, ...doc.data()} as UserDocument;
          }

          // Try by email
          if (email) {
            snapshot = await db
              .collection(COLLECTIONS.USERS)
              .where('email', '==', email)
              .limit(1)
              .get();

            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              // Link Stripe customer to existing user
              await doc.ref.update({
                stripeCustomerId,
                updatedAt: FieldValue.serverTimestamp(),
              });
              return {id: doc.id, ...doc.data(), stripeCustomerId} as UserDocument;
            }
          }

          // Create new user with Stripe customer ID as document ID
          const userId = stripeCustomerId;
          await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .set({
              id: userId,
              email: email || '',
              stripeCustomerId,
              ...defaultData,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });

          return {
            id: userId,
            email: email || '',
            stripeCustomerId,
            ...defaultData,
          } as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'UPSERT_USER_BY_STRIPE_CUSTOMER_FAILED',
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
            code: 'DELETE_MEMBERSHIP_FAILED',
            message: `Failed to delete membership ${membershipId} for user ${userId}`,
            cause: error,
          }),
      }),

    getNextMembershipNumber: (year) =>
      Effect.gen(function* () {
        const counterRef = db.collection('counters').doc(`membership_${year}`);

        // Use transaction for atomic increment
        const newNumber = yield* Effect.tryPromise({
          try: () =>
            db.runTransaction(async (transaction) => {
              const counterDoc = await transaction.get(counterRef);

              let nextNumber: number;
              if (!counterDoc.exists) {
                nextNumber = 1;
                transaction.set(counterRef, {
                  year,
                  lastNumber: 1,
                  updatedAt: FieldValue.serverTimestamp(),
                });
              } else {
                const data = counterDoc.data();
                if (!data) {
                  throw new Error('Counter document exists but has no data');
                }
                nextNumber = (data.lastNumber || 0) + 1;
                transaction.update(counterRef, {
                  lastNumber: nextNumber,
                  updatedAt: FieldValue.serverTimestamp(),
                });
              }

              return nextNumber;
            }),
          catch: (error) =>
            new FirestoreError({
              code: 'COUNTER_INCREMENT_FAILED',
              message: 'Failed to get next membership number',
              cause: error,
            }),
        });

        // Format: DEC-2025-000001
        return `DEC-${year}-${String(newNumber).padStart(6, '0')}`;
      }),

    getMembershipCard: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection('cards')
            .doc('current')
            .get();
          if (!doc.exists) return null;
          return {id: doc.id, ...doc.data()} as MembershipCard;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_CARD_FAILED',
            message: `Failed to get membership card for user ${userId}`,
            cause: error,
          }),
      }),

    setMembershipCard: (userId, card) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection('cards')
            .doc('current')
            .set({
              ...card,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            }),
        catch: (error) =>
          new FirestoreError({
            code: 'SET_CARD_FAILED',
            message: `Failed to set membership card for user ${userId}`,
            cause: error,
          }),
      }),

    updateMembershipCard: (userId, data) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection('cards')
            .doc('current')
            .update({
              ...data,
              updatedAt: FieldValue.serverTimestamp(),
            }),
        catch: (error) =>
          new FirestoreError({
            code: 'UPDATE_CARD_FAILED',
            message: `Failed to update membership card for user ${userId}`,
            cause: error,
          }),
      }),

    getMembershipByNumber: (membershipNumber) =>
      Effect.tryPromise({
        try: async () => {
          // Collection group query across all users' cards
          const snapshot = await db
            .collectionGroup('cards')
            .where('membershipNumber', '==', membershipNumber)
            .limit(1)
            .get();

          if (snapshot.empty) return null;

          const doc = snapshot.docs[0];
          const card = {id: doc.id, ...doc.data()} as MembershipCard;

          // Extract userId from path: users/{userId}/cards/current
          const parentRef = doc.ref.parent.parent;
          if (!parentRef) {
            throw new Error('Invalid card document path structure');
          }
          const userId = parentRef.id;

          return {userId, card};
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_BY_NUMBER_FAILED',
            message: `Failed to get membership by number ${membershipNumber}`,
            cause: error,
          }),
      }),

    // Admin query methods
    getAllMemberships: (params) =>
      Effect.tryPromise({
        try: async () => {
          // Use Firestore.Query as the base type (compatible with both CollectionGroup and Query)
          type FirestoreQuery = FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
          let query: FirestoreQuery = db.collectionGroup('memberships');

          // Apply filters
          if (params.status) {
            query = query.where('status', '==', params.status);
          }

          if (params.planType) {
            query = query.where('planType', '==', params.planType);
          }

          if (params.expiringWithinDays) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + params.expiringWithinDays);
            const expiryTimestamp = Timestamp.fromDate(expiryDate);
            query = query.where('endDate', '<=', expiryTimestamp);
          }

          // Order and paginate
          query = query.orderBy('endDate', 'desc');

          const pageSize = params.pageSize || 20;
          const page = params.page || 1;
          const offset = (page - 1) * pageSize;

          // Get total count (separate query)
          const countSnapshot = await query.count().get();
          const total = countSnapshot.data().count;

          // Get page of results
          const snapshot = await query.offset(offset).limit(pageSize).get();

          // Fetch user data for each membership
          const members: MemberWithMembership[] = await Promise.all(
            snapshot.docs.map(async (doc) => {
              const membership = {id: doc.id, ...doc.data()} as MembershipDocument;
              // Extract userId from path: users/{userId}/memberships/{membershipId}
              const parentRef = doc.ref.parent.parent;
              if (!parentRef) {
                throw new Error('Invalid membership document path structure');
              }
              const userId = parentRef.id;

              // Fetch user
              const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
              const user = userDoc.exists
                ? ({id: userDoc.id, ...userDoc.data()} as UserDocument)
                : null;

              // Fetch card
              const cardDoc = await db
                .collection(COLLECTIONS.USERS)
                .doc(userId)
                .collection('cards')
                .doc('current')
                .get();
              const card = cardDoc.exists
                ? ({id: cardDoc.id, ...cardDoc.data()} as MembershipCard)
                : null;

              return {user, membership, card};
            }),
          );

          // Filter by search query if provided
          let filteredMembers = members;
          if (params.query) {
            const q = params.query.toLowerCase();
            filteredMembers = members.filter(
              (m) =>
                m.user?.email?.toLowerCase().includes(q) ||
                m.user?.name?.toLowerCase().includes(q) ||
                m.card?.membershipNumber?.toLowerCase().includes(q),
            );
          }

          // Serialize timestamps to ISO strings for client compatibility
          const serializedMembers = filteredMembers.map((m) => serializeTimestamps(m));

          return {members: serializedMembers, total};
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_ALL_MEMBERSHIPS_FAILED',
            message: 'Failed to get all memberships',
            cause: error,
          }),
      }),

    getStats: () =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db.collection('stats').doc('memberships').get();
          if (!doc.exists) return null;
          return doc.data() as MembershipStats;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_STATS_FAILED',
            message: 'Failed to get membership stats',
            cause: error,
          }),
      }),

    updateStats: (stats) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection('stats')
            .doc('memberships')
            .set({...stats, updatedAt: new Date().toISOString()}, {merge: true}),
        catch: (error) =>
          new FirestoreError({
            code: 'UPDATE_STATS_FAILED',
            message: 'Failed to update membership stats',
            cause: error,
          }),
      }),

    logAuditEntry: (userId, action, details) =>
      Effect.tryPromise({
        try: () =>
          db.collection(COLLECTIONS.USERS).doc(userId).collection('audit').add({
            action,
            details,
            timestamp: FieldValue.serverTimestamp(),
          }),
        catch: (error) =>
          new FirestoreError({
            code: 'AUDIT_LOG_FAILED',
            message: `Failed to log audit entry for ${userId}`,
            cause: error,
          }),
      }),

    createUser: (userId, data) =>
      Effect.tryPromise({
        try: async () => {
          const userData = {
            id: userId,
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };
          await db.collection(COLLECTIONS.USERS).doc(userId).set(userData);
          return {id: userId, ...data} as UserDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'CREATE_USER_FAILED',
            message: `Failed to create user ${userId}`,
            cause: error,
          }),
      }),

    updateUser: (userId, data) =>
      Effect.tryPromise({
        try: () =>
          db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .update({
              ...data,
              updatedAt: FieldValue.serverTimestamp(),
            }),
        catch: (error) =>
          new FirestoreError({
            code: 'UPDATE_USER_FAILED',
            message: `Failed to update user ${userId}`,
            cause: error,
          }),
      }),

    getMemberAuditLog: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection('audit')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

          return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as AuditEntryDocument[];
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_AUDIT_LOG_FAILED',
            message: `Failed to get audit log for user ${userId}`,
            cause: error,
          }),
      }),

    getExpiringMemberships: (withinDays) =>
      Effect.tryPromise({
        try: async () => {
          const now = new Date();
          const expiryDate = new Date();
          expiryDate.setDate(now.getDate() + withinDays);

          // Convert to Firestore Timestamps for proper query comparison
          const nowTimestamp = Timestamp.fromDate(now);
          const expiryTimestamp = Timestamp.fromDate(expiryDate);

          // Query memberships expiring within the time frame
          // Using a single range query to avoid needing composite index
          console.log(
            '[getExpiringMemberships] Querying for memberships expiring between',
            now,
            'and',
            expiryDate,
          );
          const snapshot = await db
            .collectionGroup('memberships')
            .where('endDate', '<=', expiryTimestamp)
            .orderBy('endDate', 'asc')
            .get();

          console.log(
            '[getExpiringMemberships] Query successful, found',
            snapshot.size,
            'documents',
          );

          // Fetch user and card data for each membership
          const members: MemberWithMembership[] = await Promise.all(
            snapshot.docs
              .filter((doc) => {
                // Filter by status and date range in memory to avoid composite index
                const data = doc.data();
                const isActiveOrPastDue = data.status === 'active' || data.status === 'past_due';

                // Check if endDate is within our range
                const endDate = data.endDate;
                let endDateObj: Date;

                // Handle Firestore Timestamp
                if (endDate && typeof endDate === 'object' && 'toDate' in endDate) {
                  endDateObj = endDate.toDate();
                } else {
                  endDateObj = new Date(endDate);
                }

                const isInRange = endDateObj >= now && endDateObj <= expiryDate;

                return isActiveOrPastDue && isInRange;
              })
              .map(async (doc) => {
                const membership = {id: doc.id, ...doc.data()} as MembershipDocument;
                const parentRef = doc.ref.parent.parent;
                if (!parentRef) {
                  throw new Error('Invalid membership document path structure');
                }
                const userId = parentRef.id;

                const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
                const user = userDoc.exists
                  ? ({id: userDoc.id, ...userDoc.data()} as UserDocument)
                  : null;

                const cardDoc = await db
                  .collection(COLLECTIONS.USERS)
                  .doc(userId)
                  .collection('cards')
                  .doc('current')
                  .get();
                const card = cardDoc.exists
                  ? ({id: cardDoc.id, ...cardDoc.data()} as MembershipCard)
                  : null;

                return {user, membership, card};
              }),
          );

          // Serialize timestamps to ISO strings for client compatibility
          return members.map((m) => serializeTimestamps(m));
        },
        catch: (error) => {
          console.error('[getExpiringMemberships] Error caught:', error);
          console.error(
            '[getExpiringMemberships] Error stack:',
            error instanceof Error ? error.stack : 'No stack',
          );
          return new FirestoreError({
            code: 'GET_EXPIRING_MEMBERSHIPS_FAILED',
            message: `Failed to get expiring memberships: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          });
        },
      }),

    softDeleteMember: (userId, deletedBy, reason) =>
      Effect.tryPromise({
        try: async () => {
          const batch = db.batch();

          // Get all memberships for this user
          const membershipsSnapshot = await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection(COLLECTIONS.MEMBERSHIPS)
            .get();

          // Update all memberships to deleted status
          membershipsSnapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
              status: 'deleted',
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          // Update card status to deleted
          const cardRef = db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection('cards')
            .doc('current');
          const cardDoc = await cardRef.get();
          if (cardDoc.exists) {
            batch.update(cardRef, {
              status: 'deleted',
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          // Add audit entry
          const auditRef = db.collection(COLLECTIONS.USERS).doc(userId).collection('audit').doc();
          batch.set(auditRef, {
            action: 'MEMBER_DELETED',
            details: {
              deletedBy,
              reason,
            },
            timestamp: FieldValue.serverTimestamp(),
          });

          await batch.commit();
        },
        catch: (error) =>
          new FirestoreError({
            code: 'SOFT_DELETE_FAILED',
            message: `Failed to soft delete member ${userId}`,
            cause: error,
          }),
      }),

    getAllUsers: () =>
      Effect.tryPromise({
        try: async () => {
          const snapshot = await db.collection(COLLECTIONS.USERS).get();
          return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}) as UserDocument);
        },
        catch: (error) =>
          new FirestoreError({
            code: 'GET_ALL_USERS_FAILED',
            message: 'Failed to get all users',
            cause: error,
          }),
      }),
  });
});

// Live layer
export const FirestoreServiceLive = Layer.effect(FirestoreService, make);

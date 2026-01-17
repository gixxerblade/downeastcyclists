import {Firestore, FieldValue} from '@google-cloud/firestore';
import {Context, Effect, Layer} from 'effect';
import {readFileSync, existsSync} from 'fs';
import {join} from 'path';

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

// Service interface
export interface FirestoreService {
  readonly getUser: (userId: string) => Effect.Effect<UserDocument | null, FirestoreError>;

  readonly getUserByEmail: (email: string) => Effect.Effect<UserDocument | null, FirestoreError>;

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
}

// Service tag
export const FirestoreService = Context.GenericTag<FirestoreService>('FirestoreService');

// Create Firestore instance
const createFirestoreInstance = (): Firestore => {
  // Try to load from service account file first (production)
  const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');

  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    return new Firestore({
      projectId: serviceAccount.project_id,
      credentials: serviceAccount,
    });
  }

  // Fall back to environment variables (local development)
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error(
      'Firebase credentials not found. Either provide firebase-service-account.json or set GOOGLE_PROJECT_ID and GOOGLE_PRIVATE_KEY environment variables.'
    );
  }

  return new Firestore({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
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
            // Note: Also including "canceled" temporarily for debugging
            const snapshot = await db
              .collection(COLLECTIONS.USERS)
              .doc(userId)
              .collection(COLLECTIONS.MEMBERSHIPS)
              .where('status', 'in', ['active', 'trialing', 'past_due', 'canceled'])
              .orderBy('endDate', 'desc')
              .limit(1)
              .get();

            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              return {id: doc.id, ...doc.data()} as MembershipDocument;
            }
          } catch (indexError: any) {
            // If index error, log it and fall back to getting all memberships
            console.error(
              'Firestore index error (expected if indexes not deployed):',
              indexError.message,
            );

            // Fallback: get all memberships and filter in memory
            const allMemberships = await db
              .collection(COLLECTIONS.USERS)
              .doc(userId)
              .collection(COLLECTIONS.MEMBERSHIPS)
              .get();

            if (allMemberships.empty) {
              console.log(`No memberships found for user ${userId}`);
              return null;
            }

            // Log all memberships for debugging
            console.log(`Found ${allMemberships.size} membership(s) for user ${userId}:`);
            allMemberships.docs.forEach((doc) => {
              console.log(
                `  - ID: ${doc.id}, Status: ${doc.data().status}, EndDate: ${doc.data().endDate}`,
              );
            });

            // Filter and sort in memory
            // Note: Also including "canceled" temporarily for debugging
            const activeMemberships = allMemberships.docs
              .map((doc) => ({id: doc.id, ...doc.data()}) as MembershipDocument)
              .filter((m) => ['active', 'trialing', 'past_due', 'canceled'].includes(m.status))
              .sort((a, b) => {
                const aDate = a.endDate.toDate?.() || new Date(a.endDate as any);
                const bDate = b.endDate.toDate?.() || new Date(b.endDate as any);
                return bDate.getTime() - aDate.getTime();
              });

            if (activeMemberships.length > 0) {
              console.log(
                `Found active membership: ${activeMemberships[0].id} (${activeMemberships[0].status})`,
              );
              return activeMemberships[0];
            }

            console.log(`No active memberships found for user ${userId}`);
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
            query = query.where('endDate', '<=', expiryDate);
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

          return {members: filteredMembers, total};
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
  });
});

// Live layer
export const FirestoreServiceLive = Layer.effect(FirestoreService, make);

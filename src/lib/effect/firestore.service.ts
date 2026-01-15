import { Context, Effect, Layer } from "effect";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { FirestoreError } from "./errors";
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

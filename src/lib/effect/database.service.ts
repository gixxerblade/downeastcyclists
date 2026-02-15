import {eq} from 'drizzle-orm';
import {Context, Effect, Layer} from 'effect';

import {db} from '@/src/db/client';
import {users} from '@/src/db/schema/tables';

import {DatabaseError} from './errors';
import type {UserDocument} from './schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps flat Postgres user row to the UserDocument schema shape,
 * collapsing address_* columns into a nested address object.
 */
function rowToUserDocument(row: typeof users.$inferSelect): UserDocument {
  return {
    id: row.firebaseUid,
    email: row.email,
    name: row.name ?? undefined,
    phone: row.phone ?? undefined,
    address: {
      street: row.addressStreet ?? undefined,
      city: row.addressCity ?? undefined,
      state: row.addressState ?? undefined,
      zip: row.addressZip ?? undefined,
    },
    stripeCustomerId: row.stripeCustomerId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Resolves a Firebase UID to the internal Postgres UUID.
 * Returns the full user row so callers can reuse it without a second query.
 */
export const resolveUserId = (
  firebaseUid: string,
): Effect.Effect<typeof users.$inferSelect, DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      const row = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!row) {
        throw new Error(`No user found for firebase_uid ${firebaseUid}`);
      }
      return row;
    },
    catch: (error) =>
      new DatabaseError({
        code: 'RESOLVE_USER_ID_FAILED',
        message: `Failed to resolve firebase UID ${firebaseUid} to internal ID`,
        cause: error,
      }),
  });

// ---------------------------------------------------------------------------
// Service interface — user management subset
// ---------------------------------------------------------------------------

export interface DatabaseService {
  readonly getUser: (userId: string) => Effect.Effect<UserDocument | null, DatabaseError>;

  readonly getUserByEmail: (email: string) => Effect.Effect<UserDocument | null, DatabaseError>;

  readonly getUserByStripeCustomerId: (
    customerId: string,
  ) => Effect.Effect<UserDocument | null, DatabaseError>;

  readonly createUser: (
    userId: string,
    data: Omit<UserDocument, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Effect.Effect<UserDocument, DatabaseError>;

  readonly updateUser: (
    userId: string,
    data: Partial<Omit<UserDocument, 'id' | 'createdAt'>>,
  ) => Effect.Effect<void, DatabaseError>;

  readonly setUser: (
    userId: string,
    data: Partial<UserDocument>,
    merge?: boolean,
  ) => Effect.Effect<void, DatabaseError>;

  readonly upsertUserByStripeCustomer: (
    stripeCustomerId: string,
    email: string,
    defaultData: Partial<UserDocument>,
  ) => Effect.Effect<UserDocument, DatabaseError>;
}

// Service tag
export const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService');

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const make = Effect.sync(() => {
  return DatabaseService.of({
    getUser: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const row = await db
            .select()
            .from(users)
            .where(eq(users.firebaseUid, userId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (!row) return null;
          return rowToUserDocument(row);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_USER_FAILED',
            message: `Failed to get user ${userId}`,
            cause: error,
          }),
      }),

    getUserByEmail: (email) =>
      Effect.tryPromise({
        try: async () => {
          const row = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (!row) return null;
          return rowToUserDocument(row);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_USER_BY_EMAIL_FAILED',
            message: `Failed to get user by email ${email}`,
            cause: error,
          }),
      }),

    getUserByStripeCustomerId: (customerId) =>
      Effect.tryPromise({
        try: async () => {
          const row = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (!row) return null;
          return rowToUserDocument(row);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_USER_BY_CUSTOMER_ID_FAILED',
            message: `Failed to get user by Stripe customer ID ${customerId}`,
            cause: error,
          }),
      }),

    createUser: (userId, data) =>
      Effect.tryPromise({
        try: async () => {
          const now = new Date();
          const inserted = await db
            .insert(users)
            .values({
              firebaseUid: userId,
              email: data.email,
              name: data.name ?? null,
              phone: data.phone ?? null,
              addressStreet: data.address?.street ?? null,
              addressCity: data.address?.city ?? null,
              addressState: data.address?.state ?? null,
              addressZip: data.address?.zip ?? null,
              stripeCustomerId: data.stripeCustomerId ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          return rowToUserDocument(inserted[0]);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'CREATE_USER_FAILED',
            message: `Failed to create user ${userId}`,
            cause: error,
          }),
      }),

    updateUser: (userId, data) =>
      Effect.tryPromise({
        try: async () => {
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (data.email !== undefined) updates.email = data.email;
          if (data.name !== undefined) updates.name = data.name ?? null;
          if (data.phone !== undefined) updates.phone = data.phone ?? null;
          if (data.stripeCustomerId !== undefined)
            updates.stripeCustomerId = data.stripeCustomerId ?? null;

          if (data.address) {
            if (data.address.street !== undefined)
              updates.addressStreet = data.address.street ?? null;
            if (data.address.city !== undefined) updates.addressCity = data.address.city ?? null;
            if (data.address.state !== undefined) updates.addressState = data.address.state ?? null;
            if (data.address.zip !== undefined) updates.addressZip = data.address.zip ?? null;
          }

          await db.update(users).set(updates).where(eq(users.firebaseUid, userId));
        },
        catch: (error) =>
          new DatabaseError({
            code: 'UPDATE_USER_FAILED',
            message: `Failed to update user ${userId}`,
            cause: error,
          }),
      }),

    setUser: (userId, data, merge = true) =>
      Effect.tryPromise({
        try: async () => {
          if (merge) {
            // Merge behavior: upsert with ON CONFLICT, only overwriting provided fields
            const values: Record<string, unknown> = {
              firebaseUid: userId,
              email: data.email ?? '',
              updatedAt: new Date(),
            };

            if (data.name !== undefined) values.name = data.name ?? null;
            if (data.phone !== undefined) values.phone = data.phone ?? null;
            if (data.stripeCustomerId !== undefined)
              values.stripeCustomerId = data.stripeCustomerId ?? null;

            if (data.address) {
              if (data.address.street !== undefined)
                values.addressStreet = data.address.street ?? null;
              if (data.address.city !== undefined) values.addressCity = data.address.city ?? null;
              if (data.address.state !== undefined)
                values.addressState = data.address.state ?? null;
              if (data.address.zip !== undefined) values.addressZip = data.address.zip ?? null;
            }

            // Build the set clause for the ON CONFLICT update
            const setClause: Record<string, unknown> = {
              updatedAt: new Date(),
            };
            for (const [key, value] of Object.entries(values)) {
              if (key !== 'firebaseUid') {
                setClause[key] = value;
              }
            }

            await db
              .insert(users)
              .values(values as typeof users.$inferInsert)
              .onConflictDoUpdate({
                target: users.firebaseUid,
                set: setClause as Partial<typeof users.$inferInsert>,
              });
          } else {
            // Full replace: delete existing and insert fresh
            const now = new Date();
            await db.delete(users).where(eq(users.firebaseUid, userId));
            await db.insert(users).values({
              firebaseUid: userId,
              email: data.email ?? '',
              name: data.name ?? null,
              phone: data.phone ?? null,
              addressStreet: data.address?.street ?? null,
              addressCity: data.address?.city ?? null,
              addressState: data.address?.state ?? null,
              addressZip: data.address?.zip ?? null,
              stripeCustomerId: data.stripeCustomerId ?? null,
              createdAt: now,
              updatedAt: now,
            });
          }
        },
        catch: (error) =>
          new DatabaseError({
            code: 'SET_USER_FAILED',
            message: `Failed to set user ${userId}`,
            cause: error,
          }),
      }),

    upsertUserByStripeCustomer: (stripeCustomerId, email, defaultData) =>
      Effect.tryPromise({
        try: async () => {
          // First try to find by Stripe customer ID
          let row = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, stripeCustomerId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (row) {
            // Update email if changed
            if (email && row.email !== email) {
              await db
                .update(users)
                .set({email, updatedAt: new Date()})
                .where(eq(users.id, row.id));
              row = {...row, email};
            }
            return rowToUserDocument(row);
          }

          // Try by email
          if (email) {
            row = await db
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (row) {
              // Link Stripe customer to existing user
              await db
                .update(users)
                .set({stripeCustomerId, updatedAt: new Date()})
                .where(eq(users.id, row.id));
              return rowToUserDocument({...row, stripeCustomerId});
            }
          }

          // Create new user with stripeCustomerId as the firebase UID
          // (mirrors Firestore behavior where document ID = stripeCustomerId)
          const now = new Date();
          const inserted = await db
            .insert(users)
            .values({
              firebaseUid: stripeCustomerId,
              email: email || '',
              name: defaultData.name ?? null,
              phone: defaultData.phone ?? null,
              addressStreet: defaultData.address?.street ?? null,
              addressCity: defaultData.address?.city ?? null,
              addressState: defaultData.address?.state ?? null,
              addressZip: defaultData.address?.zip ?? null,
              stripeCustomerId,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          return rowToUserDocument(inserted[0]);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'UPSERT_USER_BY_STRIPE_CUSTOMER_FAILED',
            message: `Failed to upsert user for Stripe customer ${stripeCustomerId}`,
            cause: error,
          }),
      }),
  });
});

// Live layer
export const DatabaseServiceLive = Layer.effect(DatabaseService, make);

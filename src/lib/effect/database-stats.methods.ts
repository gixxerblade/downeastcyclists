import {eq} from 'drizzle-orm';
import {Effect} from 'effect';

import {
  auditLog,
  membershipCards,
  memberships,
  membershipStats,
  users,
} from '@/src/db/schema/tables';

import {resolveUserId} from './database.service';
import {DatabaseError} from './errors';
import type {MembershipStats, UserDocument} from './schemas';

// Lazy db loader — avoids triggering Neon connection at import time
function getDb() {
  return (require('@/src/db/client') as typeof import('@/src/db/client')).db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Stats & admin method implementations
// ---------------------------------------------------------------------------

export function createStatsMethods() {
  const db = getDb();
  return {
    getStats: () =>
      Effect.tryPromise({
        try: async () => {
          const row = await db
            .select()
            .from(membershipStats)
            .where(eq(membershipStats.id, 'memberships'))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (!row) return null;

          return {
            totalMembers: row.totalMembers,
            activeMembers: row.activeMembers,
            expiredMembers: row.expiredMembers,
            canceledMembers: row.canceledMembers,
            individualCount: row.individualCount,
            familyCount: row.familyCount,
            monthlyRevenue: Number(row.monthlyRevenue),
            yearlyRevenue: Number(row.yearlyRevenue),
            updatedAt: row.updatedAt.toISOString(),
          } satisfies MembershipStats;
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_STATS_FAILED',
            message: 'Failed to get membership stats',
            cause: error,
          }),
      }),

    updateStats: (stats: Partial<MembershipStats>) =>
      Effect.tryPromise({
        try: async () => {
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (stats.totalMembers !== undefined) updates.totalMembers = stats.totalMembers;
          if (stats.activeMembers !== undefined) updates.activeMembers = stats.activeMembers;
          if (stats.expiredMembers !== undefined) updates.expiredMembers = stats.expiredMembers;
          if (stats.canceledMembers !== undefined) updates.canceledMembers = stats.canceledMembers;
          if (stats.individualCount !== undefined) updates.individualCount = stats.individualCount;
          if (stats.familyCount !== undefined) updates.familyCount = stats.familyCount;
          if (stats.monthlyRevenue !== undefined)
            updates.monthlyRevenue = String(stats.monthlyRevenue);
          if (stats.yearlyRevenue !== undefined)
            updates.yearlyRevenue = String(stats.yearlyRevenue);

          await db
            .insert(membershipStats)
            .values({
              id: 'memberships',
              ...updates,
            } as typeof membershipStats.$inferInsert)
            .onConflictDoUpdate({
              target: membershipStats.id,
              set: updates as Partial<typeof membershipStats.$inferInsert>,
            });
        },
        catch: (error) =>
          new DatabaseError({
            code: 'UPDATE_STATS_FAILED',
            message: 'Failed to update membership stats',
            cause: error,
          }),
      }),

    getAllUsers: () =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db.select().from(users);
          return rows.map(rowToUserDocument);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_ALL_USERS_FAILED',
            message: 'Failed to get all users',
            cause: error,
          }),
      }),

    softDeleteMember: (userId: string, deletedBy: string, reason: string) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            await db.transaction(async (tx) => {
              // Update all memberships to deleted status
              await tx
                .update(memberships)
                .set({status: 'deleted', updatedAt: new Date()})
                .where(eq(memberships.userId, userRow.id));

              // Update card status to deleted
              await tx
                .update(membershipCards)
                .set({status: 'deleted', updatedAt: new Date()})
                .where(eq(membershipCards.userId, userRow.id));

              // Log audit entry
              await tx.insert(auditLog).values({
                userId: userRow.id,
                action: 'MEMBER_DELETED',
                performedBy: deletedBy,
                details: {deletedBy, reason},
                createdAt: new Date(),
              });
            });
          },
          catch: (error) =>
            new DatabaseError({
              code: 'SOFT_DELETE_FAILED',
              message: `Failed to soft delete member ${userId}`,
              cause: error,
            }),
        });
      }),
  };
}

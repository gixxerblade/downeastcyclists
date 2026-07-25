import {and, desc, eq, gte, ilike, inArray, lt, lte, or, sql} from 'drizzle-orm';
import {Effect} from 'effect';

import {emailLog, membershipCards, memberships, users} from '@/src/db/schema/tables';
import {getEffectiveMembershipStatus, toStoredMembershipStatus} from '@/src/lib/membership-status';
import {buildRenewalEmailCampaignKey, RENEWAL_EMAIL_TYPE} from '@/src/lib/renewal-email';

import {resolveUserId} from './database.service';
import {DatabaseError} from './errors';
import type {
  MemberSearchParams,
  MemberWithMembership,
  MembershipDocument,
  UserDocument,
} from './schemas';

// Lazy db loader — avoids triggering Neon connection at import time
function getDb() {
  return (require('@/src/db/client') as typeof import('@/src/db/client')).db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DatabaseMembershipStatus = typeof memberships.$inferSelect.status;

const currentDatabaseStatuses: DatabaseMembershipStatus[] = [
  'active',
  'trialing',
  'past_due',
  'complimentary',
  'legacy',
];

const databaseStatuses: ReadonlySet<string> = new Set([
  ...currentDatabaseStatuses,
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'deleted',
]);

function isDatabaseMembershipStatus(status: string): status is DatabaseMembershipStatus {
  return databaseStatuses.has(status);
}

/** Maps a Postgres membership row to the MembershipDocument schema shape. */
function rowToMembershipDocument(
  row: typeof memberships.$inferSelect,
  now: Date = new Date(),
): MembershipDocument {
  return {
    id: row.id,
    stripeSubscriptionId: row.stripeSubscriptionId ?? '',
    planType: row.planType,
    status: getEffectiveMembershipStatus(row.status, row.endDate, now),
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    autoRenew: row.autoRenew,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a Postgres user row to UserDocument. Duplicated from database.service to avoid circular deps. */
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
    isOrganizer: row.isOrganizer,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a Postgres membership card row to the MembershipCard schema shape. */
function rowToCardDocument(row: typeof membershipCards.$inferSelect, now: Date = new Date()) {
  return {
    id: row.id,
    userId: row.userId,
    membershipNumber: row.membershipNumber,
    memberName: row.memberName,
    email: row.email,
    planType: row.planType,
    status: getEffectiveMembershipStatus(row.status, row.validUntil, now),
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil.toISOString(),
    qrCodeData: row.qrCodeData,
    pdfUrl: row.pdfUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Membership method implementations
// ---------------------------------------------------------------------------

export function createMembershipMethods() {
  const db = getDb();
  return {
    getMembership: (userId: string, membershipId: string) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        return yield* Effect.tryPromise({
          try: async () => {
            const row = await db
              .select()
              .from(memberships)
              .where(
                and(
                  eq(memberships.userId, userRow.id),
                  eq(memberships.stripeSubscriptionId, membershipId),
                ),
              )
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (!row) return null;
            return rowToMembershipDocument(row);
          },
          catch: (error) =>
            new DatabaseError({
              code: 'GET_MEMBERSHIP_FAILED',
              message: `Failed to get membership ${membershipId} for user ${userId}`,
              cause: error,
            }),
        });
      }),

    getActiveMembership: (userId: string) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        return yield* Effect.tryPromise({
          try: async () => {
            const row = await db
              .select()
              .from(memberships)
              .where(
                and(
                  eq(memberships.userId, userRow.id),
                  inArray(memberships.status, ['active', 'trialing', 'past_due']),
                ),
              )
              .orderBy(desc(memberships.endDate))
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (!row) return null;
            return rowToMembershipDocument(row);
          },
          catch: (error) =>
            new DatabaseError({
              code: 'GET_ACTIVE_MEMBERSHIP_FAILED',
              message: `Failed to get active membership for user ${userId}`,
              cause: error,
            }),
        });
      }),

    setMembership: (userId: string, membershipId: string, data: Omit<MembershipDocument, 'id'>) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            const now = new Date();
            const subId = data.stripeSubscriptionId || membershipId;

            // Check if a membership already exists for this subscription
            const existing = await db
              .select({id: memberships.id})
              .from(memberships)
              .where(
                and(
                  eq(memberships.userId, userRow.id),
                  eq(memberships.stripeSubscriptionId, subId),
                ),
              )
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (existing) {
              await db
                .update(memberships)
                .set({
                  planType: data.planType,
                  status: toStoredMembershipStatus(data.status),
                  startDate: new Date(data.startDate as string),
                  endDate: new Date(data.endDate as string),
                  autoRenew: data.autoRenew,
                  updatedAt: now,
                })
                .where(eq(memberships.id, existing.id));
            } else {
              await db.insert(memberships).values({
                userId: userRow.id,
                stripeSubscriptionId: subId,
                planType: data.planType,
                status: toStoredMembershipStatus(data.status),
                startDate: new Date(data.startDate as string),
                endDate: new Date(data.endDate as string),
                autoRenew: data.autoRenew,
                createdAt: now,
                updatedAt: now,
              });
            }
          },
          catch: (error) =>
            new DatabaseError({
              code: 'SET_MEMBERSHIP_FAILED',
              message: `Failed to set membership ${membershipId} for user ${userId}`,
              cause: error,
            }),
        });
      }),

    updateMembership: (userId: string, membershipId: string, data: Partial<MembershipDocument>) =>
      Effect.gen(function* () {
        yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            const updates: Record<string, unknown> = {
              updatedAt: new Date(),
            };

            if (data.stripeSubscriptionId !== undefined)
              updates.stripeSubscriptionId = data.stripeSubscriptionId || null;
            if (data.planType !== undefined) updates.planType = data.planType;
            if (data.status !== undefined) updates.status = toStoredMembershipStatus(data.status);
            if (data.startDate !== undefined)
              updates.startDate = new Date(data.startDate as string);
            if (data.endDate !== undefined) updates.endDate = new Date(data.endDate as string);
            if (data.autoRenew !== undefined) updates.autoRenew = data.autoRenew;

            await db
              .update(memberships)
              .set(updates)
              .where(eq(memberships.stripeSubscriptionId, membershipId));
          },
          catch: (error) =>
            new DatabaseError({
              code: 'UPDATE_MEMBERSHIP_FAILED',
              message: `Failed to update membership ${membershipId} for user ${userId}`,
              cause: error,
            }),
        });
      }),

    deleteMembership: (userId: string, membershipId: string) =>
      Effect.gen(function* () {
        yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            await db.delete(memberships).where(eq(memberships.stripeSubscriptionId, membershipId));
          },
          catch: (error) =>
            new DatabaseError({
              code: 'DELETE_MEMBERSHIP_FAILED',
              message: `Failed to delete membership ${membershipId} for user ${userId}`,
              cause: error,
            }),
        });
      }),

    getAllMemberships: (params: MemberSearchParams) =>
      Effect.tryPromise({
        try: async () => {
          const now = new Date();
          const conditions = [];

          if (params.status) {
            if (params.status === 'expired') {
              conditions.push(inArray(memberships.status, currentDatabaseStatuses));
              conditions.push(lt(memberships.endDate, now));
            } else if (isDatabaseMembershipStatus(params.status)) {
              conditions.push(eq(memberships.status, params.status));
              if (currentDatabaseStatuses.includes(params.status)) {
                conditions.push(gte(memberships.endDate, now));
              }
            }
          }

          if (params.planType) {
            conditions.push(eq(memberships.planType, params.planType));
          }

          if (params.expiringWithinDays) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + params.expiringWithinDays);
            conditions.push(gte(memberships.endDate, new Date()));
            conditions.push(lte(memberships.endDate, expiryDate));
          }

          // Search filter: match against user email, user name, or card membership number
          if (params.query) {
            const searchPattern = `%${params.query}%`;
            const searchCondition = or(
              ilike(users.email, searchPattern),
              ilike(users.name, searchPattern),
              ilike(membershipCards.membershipNumber, searchPattern),
            );
            if (searchCondition) {
              conditions.push(searchCondition);
            }
          }

          const where = conditions.length > 0 ? and(...conditions) : undefined;

          const pageSize = params.pageSize || 20;
          const page = params.page || 1;
          const offset = (page - 1) * pageSize;

          // Single JOIN query for count
          const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(memberships)
            .innerJoin(users, eq(memberships.userId, users.id))
            .leftJoin(membershipCards, eq(membershipCards.membershipId, memberships.id))
            .where(where);

          const total = countResult[0]?.count ?? 0;

          // Single JOIN query for data with pagination
          const rows = await db
            .select({
              membership: memberships,
              user: users,
              card: membershipCards,
            })
            .from(memberships)
            .innerJoin(users, eq(memberships.userId, users.id))
            .leftJoin(membershipCards, eq(membershipCards.membershipId, memberships.id))
            .where(where)
            .orderBy(desc(memberships.endDate))
            .limit(pageSize)
            .offset(offset);

          const visibleUserIds = rows.map((row) => row.user.id);
          const renewalEmailRows =
            visibleUserIds.length > 0
              ? await db
                  .select()
                  .from(emailLog)
                  .where(
                    and(
                      inArray(emailLog.userId, visibleUserIds),
                      eq(emailLog.emailType, RENEWAL_EMAIL_TYPE),
                      eq(emailLog.status, 'sent'),
                    ),
                  )
                  .orderBy(desc(emailLog.createdAt))
              : [];
          const latestRenewalEmailByCampaign = new Map<string, (typeof renewalEmailRows)[number]>();

          for (const log of renewalEmailRows) {
            const key = `${log.userId}:${log.campaignKey}`;
            if (!latestRenewalEmailByCampaign.has(key)) {
              latestRenewalEmailByCampaign.set(key, log);
            }
          }

          const members: MemberWithMembership[] = rows.map((row) => ({
            user: row.user ? rowToUserDocument(row.user) : null,
            membership: row.membership ? rowToMembershipDocument(row.membership, now) : null,
            card: row.card ? rowToCardDocument(row.card, now) : null,
            renewalEmail: (() => {
              if (!row.membership) return null;
              const campaignKey = buildRenewalEmailCampaignKey(
                row.user.firebaseUid,
                row.membership,
              );
              const latest = latestRenewalEmailByCampaign.get(`${row.user.id}:${campaignKey}`);
              if (!latest) return null;
              return {
                lastSentAt: latest.createdAt.toISOString(),
                lastSentBy: latest.sentBy,
                lastSentByEmail: latest.sentByEmail ?? null,
                deliveryType: latest.deliveryType,
                campaignKey: latest.campaignKey,
              };
            })(),
          }));

          return {members, total};
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_ALL_MEMBERSHIPS_FAILED',
            message: 'Failed to get all memberships',
            cause: error,
          }),
      }),

    getExpiringMemberships: (withinDays: number) =>
      Effect.tryPromise({
        try: async () => {
          const now = new Date();
          const expiryDate = new Date();
          expiryDate.setDate(now.getDate() + withinDays);

          const rows = await db
            .select({
              membership: memberships,
              user: users,
              card: membershipCards,
            })
            .from(memberships)
            .innerJoin(users, eq(memberships.userId, users.id))
            .leftJoin(membershipCards, eq(membershipCards.membershipId, memberships.id))
            .where(
              and(
                inArray(memberships.status, currentDatabaseStatuses),
                gte(memberships.endDate, now),
                lte(memberships.endDate, expiryDate),
              ),
            )
            .orderBy(memberships.endDate);

          return rows.map((row) => ({
            user: row.user ? rowToUserDocument(row.user) : null,
            membership: row.membership ? rowToMembershipDocument(row.membership, now) : null,
            card: row.card ? rowToCardDocument(row.card, now) : null,
            renewalEmail: null,
          }));
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_EXPIRING_MEMBERSHIPS_FAILED',
            message: `Failed to get expiring memberships within ${withinDays} days`,
            cause: error,
          }),
      }),
  };
}

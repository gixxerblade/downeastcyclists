import {eq, sql} from 'drizzle-orm';
import {Effect} from 'effect';

import {db} from '@/src/db/client';
import {membershipCards, membershipCounters, users} from '@/src/db/schema/tables';

import {resolveUserId} from './database.service';
import {DatabaseError} from './errors';
import type {MembershipCard, MembershipStatus} from './schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToCardDocument(row: typeof membershipCards.$inferSelect): MembershipCard {
  return {
    id: row.id,
    userId: row.userId,
    membershipNumber: row.membershipNumber,
    memberName: row.memberName,
    email: row.email,
    planType: row.planType,
    status: row.status as MembershipStatus,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil.toISOString(),
    qrCodeData: row.qrCodeData,
    pdfUrl: row.pdfUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Card method implementations
// ---------------------------------------------------------------------------

export function createCardMethods() {
  return {
    getMembershipCard: (userId: string) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        return yield* Effect.tryPromise({
          try: async () => {
            const row = await db
              .select()
              .from(membershipCards)
              .where(eq(membershipCards.userId, userRow.id))
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (!row) return null;
            return rowToCardDocument(row);
          },
          catch: (error) =>
            new DatabaseError({
              code: 'GET_CARD_FAILED',
              message: `Failed to get membership card for user ${userId}`,
              cause: error,
            }),
        });
      }),

    setMembershipCard: (userId: string, card: Omit<MembershipCard, 'id'>) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            const now = new Date();

            // Find the membership for this user to link the card
            const existingCard = await db
              .select()
              .from(membershipCards)
              .where(eq(membershipCards.userId, userRow.id))
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (existingCard) {
              // Update existing card
              await db
                .update(membershipCards)
                .set({
                  membershipNumber: card.membershipNumber,
                  memberName: card.memberName,
                  email: card.email,
                  planType: card.planType,
                  status: card.status,
                  validFrom: new Date(card.validFrom),
                  validUntil: new Date(card.validUntil),
                  qrCodeData: card.qrCodeData,
                  pdfUrl: card.pdfUrl ?? null,
                  updatedAt: now,
                })
                .where(eq(membershipCards.id, existingCard.id));
            } else {
              // Insert new card — requires a membershipId FK
              const membershipId = (card as Record<string, unknown>).membershipId as
                | string
                | undefined;

              await db.insert(membershipCards).values({
                userId: userRow.id,
                membershipId: membershipId ?? userRow.id,
                membershipNumber: card.membershipNumber,
                memberName: card.memberName,
                email: card.email,
                planType: card.planType,
                status: card.status,
                validFrom: new Date(card.validFrom),
                validUntil: new Date(card.validUntil),
                qrCodeData: card.qrCodeData,
                pdfUrl: card.pdfUrl ?? null,
                createdAt: now,
                updatedAt: now,
              });
            }
          },
          catch: (error) =>
            new DatabaseError({
              code: 'SET_CARD_FAILED',
              message: `Failed to set membership card for user ${userId}`,
              cause: error,
            }),
        });
      }),

    updateMembershipCard: (userId: string, data: Partial<MembershipCard>) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            const updates: Record<string, unknown> = {
              updatedAt: new Date(),
            };

            if (data.membershipNumber !== undefined)
              updates.membershipNumber = data.membershipNumber;
            if (data.memberName !== undefined) updates.memberName = data.memberName;
            if (data.email !== undefined) updates.email = data.email;
            if (data.planType !== undefined) updates.planType = data.planType;
            if (data.status !== undefined) updates.status = data.status;
            if (data.validFrom !== undefined) updates.validFrom = new Date(data.validFrom);
            if (data.validUntil !== undefined) updates.validUntil = new Date(data.validUntil);
            if (data.qrCodeData !== undefined) updates.qrCodeData = data.qrCodeData;
            if (data.pdfUrl !== undefined) updates.pdfUrl = data.pdfUrl;

            await db
              .update(membershipCards)
              .set(updates)
              .where(eq(membershipCards.userId, userRow.id));
          },
          catch: (error) =>
            new DatabaseError({
              code: 'UPDATE_CARD_FAILED',
              message: `Failed to update membership card for user ${userId}`,
              cause: error,
            }),
        });
      }),

    getMembershipByNumber: (membershipNumber: string) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              card: membershipCards,
              user: users,
            })
            .from(membershipCards)
            .innerJoin(users, eq(membershipCards.userId, users.id))
            .where(eq(membershipCards.membershipNumber, membershipNumber))
            .limit(1);

          if (rows.length === 0) return null;

          const row = rows[0];
          return {
            userId: row.user.firebaseUid,
            card: rowToCardDocument(row.card),
          };
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_BY_NUMBER_FAILED',
            message: `Failed to get membership by number ${membershipNumber}`,
            cause: error,
          }),
      }),

    getNextMembershipNumber: (year: number) =>
      Effect.tryPromise({
        try: async () => {
          // Atomic increment using INSERT ... ON CONFLICT DO UPDATE ... RETURNING
          // This is thread-safe and produces no duplicates
          const result = await db
            .insert(membershipCounters)
            .values({
              year,
              lastNumber: 1,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: membershipCounters.year,
              set: {
                lastNumber: sql`${membershipCounters.lastNumber} + 1`,
                updatedAt: new Date(),
              },
            })
            .returning({lastNumber: membershipCounters.lastNumber});

          const nextNumber = result[0].lastNumber;

          // Format: DEC-2025-000001
          return `DEC-${year}-${String(nextNumber).padStart(6, '0')}`;
        },
        catch: (error) =>
          new DatabaseError({
            code: 'COUNTER_INCREMENT_FAILED',
            message: 'Failed to get next membership number',
            cause: error,
          }),
      }),
  };
}

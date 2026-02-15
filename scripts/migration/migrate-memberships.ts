/**
 * Migrates Firestore memberships and cards -> Postgres tables
 */

import type {Firestore} from '@google-cloud/firestore';
import {and, eq} from 'drizzle-orm';

import {memberships, membershipCards} from '../../src/db/schema/tables';

import type {PostgresClient} from './clients';
import {toDate, log, logSuccess, logWarn, logError} from './helpers';

export interface MigratedMembership {
  postgresId: string;
  firestoreId: string;
  userId: string;
}

const VALID_STATUSES = [
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'unpaid',
  'deleted',
  'complimentary',
  'legacy',
] as const;

const VALID_PLAN_TYPES = ['individual', 'family'] as const;

function safeStatus(raw: string) {
  return (VALID_STATUSES as readonly string[]).includes(raw)
    ? (raw as (typeof VALID_STATUSES)[number])
    : ('incomplete' as const);
}

function safePlanType(raw: string) {
  return (VALID_PLAN_TYPES as readonly string[]).includes(raw)
    ? (raw as (typeof VALID_PLAN_TYPES)[number])
    : ('individual' as const);
}

export async function migrateMemberships(
  firestore: Firestore,
  pg: PostgresClient,
  uidToUuid: Map<string, string>,
): Promise<Map<string, MigratedMembership>> {
  log('--- Migrating memberships ---');
  const membershipMap = new Map<string, MigratedMembership>();
  let total = 0;
  let migrated = 0;

  const usersSnapshot = await firestore.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const firebaseUid = userDoc.id;
    const pgUserId = uidToUuid.get(firebaseUid);
    if (!pgUserId) {
      logWarn(`Skipping memberships for unmapped user ${firebaseUid}`);
      continue;
    }

    const membershipsSnap = await firestore
      .collection('users')
      .doc(firebaseUid)
      .collection('memberships')
      .get();

    for (const mDoc of membershipsSnap.docs) {
      total++;
      const data = mDoc.data();
      const firestoreId = mDoc.id;
      const status = safeStatus(data.status);
      const planType = safePlanType(data.planType);

      try {
        const inserted = await pg
          .insert(memberships)
          .values({
            userId: pgUserId,
            stripeSubscriptionId: data.stripeSubscriptionId ?? null,
            planType,
            status,
            startDate: toDate(data.startDate),
            endDate: toDate(data.endDate),
            autoRenew: data.autoRenew ?? true,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          })
          .onConflictDoNothing()
          .returning({id: memberships.id});

        if (inserted.length > 0) {
          membershipMap.set(`${firebaseUid}:${firestoreId}`, {
            postgresId: inserted[0].id,
            firestoreId,
            userId: pgUserId,
          });
          migrated++;
          logSuccess(`Membership ${firestoreId} for user ${firebaseUid}`);
        } else {
          // Already exists -- look up the existing ID for card migration
          const existing = await pg
            .select({id: memberships.id})
            .from(memberships)
            .where(
              and(
                eq(memberships.userId, pgUserId),
                eq(memberships.stripeSubscriptionId, data.stripeSubscriptionId ?? ''),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            membershipMap.set(`${firebaseUid}:${firestoreId}`, {
              postgresId: existing[0].id,
              firestoreId,
              userId: pgUserId,
            });
          }
          logSuccess(`Membership ${firestoreId} already exists (skipped)`);
          migrated++;
        }
      } catch (err) {
        logError(
          `Membership ${firestoreId} for user ${firebaseUid}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  log(`Migrated ${migrated} / ${total} membership(s)\n`);
  return membershipMap;
}

export async function migrateMembershipCards(
  firestore: Firestore,
  pg: PostgresClient,
  uidToUuid: Map<string, string>,
  membershipMap: Map<string, MigratedMembership>,
): Promise<number> {
  log('--- Migrating membership cards ---');
  let total = 0;
  let migrated = 0;

  const usersSnapshot = await firestore.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const firebaseUid = userDoc.id;
    const pgUserId = uidToUuid.get(firebaseUid);
    if (!pgUserId) continue;

    const cardDoc = await firestore
      .collection('users')
      .doc(firebaseUid)
      .collection('cards')
      .doc('current')
      .get();

    if (!cardDoc.exists) continue;
    total++;

    const data = cardDoc.data();
    if (!data) continue;

    // Resolve membership ID -- find by matching user's firebase UID prefix
    let pgMembershipId: string | null = null;
    for (const [key, val] of membershipMap.entries()) {
      if (key.startsWith(`${firebaseUid}:`)) {
        pgMembershipId = val.postgresId;
        break;
      }
    }

    if (!pgMembershipId) {
      logWarn(`No membership found for card of user ${firebaseUid}, skipping`);
      continue;
    }

    const status = safeStatus(data.status);
    const planType = safePlanType(data.planType);

    try {
      await pg
        .insert(membershipCards)
        .values({
          userId: pgUserId,
          membershipId: pgMembershipId,
          membershipNumber: data.membershipNumber,
          memberName: data.memberName || '',
          email: data.email || '',
          planType,
          status,
          validFrom: toDate(data.validFrom),
          validUntil: toDate(data.validUntil),
          qrCodeData: data.qrCodeData || '',
          pdfUrl: data.pdfUrl ?? null,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        })
        .onConflictDoUpdate({
          target: membershipCards.membershipNumber,
          set: {
            memberName: data.memberName || '',
            email: data.email || '',
            planType,
            status,
            validFrom: toDate(data.validFrom),
            validUntil: toDate(data.validUntil),
            qrCodeData: data.qrCodeData || '',
            pdfUrl: data.pdfUrl ?? null,
            updatedAt: toDate(data.updatedAt),
          },
        });

      migrated++;
      logSuccess(`Card ${data.membershipNumber} for user ${firebaseUid}`);
    } catch (err) {
      logError(`Card for user ${firebaseUid}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log(`Migrated ${migrated} / ${total} membership card(s)\n`);
  return migrated;
}

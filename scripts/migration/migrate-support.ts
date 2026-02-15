/**
 * Migrates support collections: counters, stats, audit log
 * Also provides verification logic.
 */

import type {Firestore} from '@google-cloud/firestore';
import {count} from 'drizzle-orm';

import {
  users,
  memberships,
  membershipCards,
  membershipCounters,
  membershipStats,
  auditLog,
} from '../../src/db/schema/tables';

import type {PostgresClient} from './clients';
import {toDate, log, logSuccess, logWarn, logError} from './helpers';

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------

export async function migrateCounters(firestore: Firestore, pg: PostgresClient): Promise<number> {
  log('--- Migrating membership counters ---');
  let migrated = 0;

  const snapshot = await firestore.collection('counters').get();
  log(`Found ${snapshot.size} counter document(s) in Firestore`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const year = data.year ?? parseInt(doc.id.replace('membership_', ''), 10);

    if (isNaN(year)) {
      logWarn(`Skipping counter ${doc.id} -- could not determine year`);
      continue;
    }

    try {
      await pg
        .insert(membershipCounters)
        .values({
          year,
          lastNumber: data.lastNumber ?? 0,
          updatedAt: toDate(data.updatedAt),
        })
        .onConflictDoUpdate({
          target: membershipCounters.year,
          set: {
            lastNumber: data.lastNumber ?? 0,
            updatedAt: toDate(data.updatedAt),
          },
        });

      migrated++;
      logSuccess(`Counter year=${year} lastNumber=${data.lastNumber}`);
    } catch (err) {
      logError(`Counter ${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log(`Migrated ${migrated} / ${snapshot.size} counter(s)\n`);
  return migrated;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function migrateStats(firestore: Firestore, pg: PostgresClient): Promise<boolean> {
  log('--- Migrating membership stats ---');

  const doc = await firestore.collection('stats').doc('memberships').get();
  if (!doc.exists) {
    logWarn('No stats document found in Firestore -- skipping');
    return false;
  }

  const data = doc.data();
  if (!data) {
    logWarn('Stats document exists but has no data');
    return false;
  }

  try {
    await pg
      .insert(membershipStats)
      .values({
        id: 'memberships',
        totalMembers: data.totalMembers ?? 0,
        activeMembers: data.activeMembers ?? 0,
        expiredMembers: data.expiredMembers ?? 0,
        canceledMembers: data.canceledMembers ?? 0,
        individualCount: data.individualCount ?? 0,
        familyCount: data.familyCount ?? 0,
        monthlyRevenue: String(data.monthlyRevenue ?? 0),
        yearlyRevenue: String(data.yearlyRevenue ?? 0),
        updatedAt: toDate(data.updatedAt),
      })
      .onConflictDoUpdate({
        target: membershipStats.id,
        set: {
          totalMembers: data.totalMembers ?? 0,
          activeMembers: data.activeMembers ?? 0,
          expiredMembers: data.expiredMembers ?? 0,
          canceledMembers: data.canceledMembers ?? 0,
          individualCount: data.individualCount ?? 0,
          familyCount: data.familyCount ?? 0,
          monthlyRevenue: String(data.monthlyRevenue ?? 0),
          yearlyRevenue: String(data.yearlyRevenue ?? 0),
          updatedAt: toDate(data.updatedAt),
        },
      });

    logSuccess('Stats migrated');
    return true;
  } catch (err) {
    logError(`Stats: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

const VALID_ACTIONS = [
  'MEMBER_CREATED',
  'MEMBER_UPDATED',
  'MEMBER_DELETED',
  'MEMBERSHIP_EXTENDED',
  'MEMBERSHIP_PAUSED',
  'EMAIL_CHANGED',
  'STRIPE_SYNCED',
  'REFUND_ISSUED',
  'BULK_IMPORT',
  'ADMIN_ROLE_CHANGE',
  'MEMBERSHIP_ADJUSTMENT',
  'RECONCILIATION',
] as const;

export async function migrateAuditLog(
  firestore: Firestore,
  pg: PostgresClient,
  uidToUuid: Map<string, string>,
): Promise<number> {
  log('--- Migrating audit log ---');
  let total = 0;
  let migrated = 0;

  const usersSnapshot = await firestore.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const firebaseUid = userDoc.id;
    const pgUserId = uidToUuid.get(firebaseUid);

    const auditSnapshot = await firestore
      .collection('users')
      .doc(firebaseUid)
      .collection('audit')
      .get();

    for (const auditDoc of auditSnapshot.docs) {
      total++;
      const data = auditDoc.data();

      const action = (VALID_ACTIONS as readonly string[]).includes(data.action)
        ? (data.action as (typeof VALID_ACTIONS)[number])
        : ('MEMBER_UPDATED' as const);
      const details = (data.details ?? {}) as Record<string, unknown>;

      try {
        await pg.insert(auditLog).values({
          userId: pgUserId ?? null,
          action,
          performedBy: (details.performedBy as string) ?? firebaseUid,
          performedByEmail: (details.performedByEmail as string) ?? null,
          details,
          createdAt: toDate(data.timestamp),
        });

        migrated++;
      } catch (err) {
        logError(
          `Audit entry ${auditDoc.id} for user ${firebaseUid}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (auditSnapshot.size > 0) {
      logSuccess(`${auditSnapshot.size} audit entries for user ${firebaseUid}`);
    }
  }

  log(`Migrated ${migrated} / ${total} audit log entries\n`);
  return migrated;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function verifyMigration(firestore: Firestore, pg: PostgresClient) {
  log('=== Verification ===');

  const fsUsers = await firestore.collection('users').get();
  let fsMemberships = 0;
  let fsCards = 0;
  let fsAudit = 0;

  for (const userDoc of fsUsers.docs) {
    const mSnap = await firestore
      .collection('users')
      .doc(userDoc.id)
      .collection('memberships')
      .get();
    fsMemberships += mSnap.size;

    const cDoc = await firestore
      .collection('users')
      .doc(userDoc.id)
      .collection('cards')
      .doc('current')
      .get();
    if (cDoc.exists) fsCards++;

    const aSnap = await firestore.collection('users').doc(userDoc.id).collection('audit').get();
    fsAudit += aSnap.size;
  }

  const fsCounters = await firestore.collection('counters').get();
  const fsStats = await firestore.collection('stats').doc('memberships').get();

  const pgUsers = await pg.select({n: count()}).from(users);
  const pgMemberships = await pg.select({n: count()}).from(memberships);
  const pgCards = await pg.select({n: count()}).from(membershipCards);
  const pgCounters = await pg.select({n: count()}).from(membershipCounters);
  const pgStats = await pg.select({n: count()}).from(membershipStats);
  const pgAudit = await pg.select({n: count()}).from(auditLog);

  const results = [
    {label: 'Users', firestore: fsUsers.size, postgres: Number(pgUsers[0].n)},
    {label: 'Memberships', firestore: fsMemberships, postgres: Number(pgMemberships[0].n)},
    {label: 'Cards', firestore: fsCards, postgres: Number(pgCards[0].n)},
    {label: 'Counters', firestore: fsCounters.size, postgres: Number(pgCounters[0].n)},
    {label: 'Stats', firestore: fsStats.exists ? 1 : 0, postgres: Number(pgStats[0].n)},
    {label: 'Audit Log', firestore: fsAudit, postgres: Number(pgAudit[0].n)},
  ];

  console.log('\n  Collection          Firestore    Postgres    Match');
  console.log('  ' + '-'.repeat(60));

  let allMatch = true;
  for (const r of results) {
    const match = r.firestore === r.postgres;
    if (!match) allMatch = false;
    console.log(
      `  ${r.label.padEnd(22)}${String(r.firestore).padStart(8)}  ${String(r.postgres).padStart(10)}    ${match ? 'YES' : 'NO'}`,
    );
  }

  console.log('  ' + '-'.repeat(60));
  console.log(
    allMatch ? '\n  All counts match!' : '\n  Some counts differ -- check logs above for errors.',
  );
}

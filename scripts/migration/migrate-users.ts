/**
 * Migrates Firestore users collection -> Postgres users table
 */

import type {Firestore} from '@google-cloud/firestore';

import {users} from '../../src/db/schema/tables';

import type {PostgresClient} from './clients';
import {toDate, log, logSuccess, logError} from './helpers';

export async function migrateUsers(
  firestore: Firestore,
  pg: PostgresClient,
): Promise<Map<string, string>> {
  log('--- Migrating users ---');
  const uidToUuid = new Map<string, string>();

  const snapshot = await firestore.collection('users').get();
  log(`Found ${snapshot.size} user(s) in Firestore`);

  if (snapshot.empty) return uidToUuid;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const firebaseUid = doc.id;
    const address = data.address ?? {};

    try {
      const inserted = await pg
        .insert(users)
        .values({
          firebaseUid,
          email: data.email || '',
          name: data.name ?? null,
          phone: data.phone ?? null,
          addressStreet: address.street ?? null,
          addressCity: address.city ?? null,
          addressState: address.state ?? null,
          addressZip: address.zip ?? null,
          stripeCustomerId: data.stripeCustomerId ?? null,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        })
        .onConflictDoUpdate({
          target: users.firebaseUid,
          set: {
            email: data.email || '',
            name: data.name ?? null,
            phone: data.phone ?? null,
            addressStreet: address.street ?? null,
            addressCity: address.city ?? null,
            addressState: address.state ?? null,
            addressZip: address.zip ?? null,
            stripeCustomerId: data.stripeCustomerId ?? null,
            updatedAt: toDate(data.updatedAt),
          },
        })
        .returning({id: users.id, firebaseUid: users.firebaseUid});

      uidToUuid.set(firebaseUid, inserted[0].id);
      logSuccess(`User ${firebaseUid} (${data.email})`);
    } catch (err) {
      logError(`User ${firebaseUid}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log(`Migrated ${uidToUuid.size} / ${snapshot.size} user(s)\n`);
  return uidToUuid;
}

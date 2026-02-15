/**
 * One-time migration script: Firestore -> Neon Postgres
 *
 * Reads all Firestore collections and inserts data into Postgres via Drizzle ORM.
 * Idempotent -- safe to re-run using ON CONFLICT upserts.
 *
 * Run with: npx tsx scripts/migrate-firestore-to-neon.ts
 *
 * Required env vars (via .env.local):
 *   GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY  (Firestore)
 *   NETLIFY_DATABASE_URL                                         (Neon Postgres)
 */

import * as dotenv from 'dotenv';

import {createFirestoreClient, createPostgresClient} from './migration/clients';
import {logError} from './migration/helpers';
import {migrateMemberships, migrateMembershipCards} from './migration/migrate-memberships';
import {
  migrateCounters,
  migrateStats,
  migrateAuditLog,
  verifyMigration,
} from './migration/migrate-support';
import {migrateUsers} from './migration/migrate-users';

dotenv.config({path: '.env.local'});

async function main() {
  console.log('\n========================================');
  console.log('  Firestore -> Neon Postgres Migration');
  console.log('========================================\n');

  const startTime = Date.now();

  const firestore = createFirestoreClient();
  const pg = createPostgresClient();

  // Migration order respects FK dependencies:
  // 1. Users (no deps)
  // 2. Memberships (FK -> users)
  // 3. Cards (FK -> users, memberships)
  // 4. Counters (no deps)
  // 5. Stats (no deps)
  // 6. Audit log (FK -> users, nullable)

  const uidToUuid = await migrateUsers(firestore, pg);
  const membershipMap = await migrateMemberships(firestore, pg, uidToUuid);
  await migrateMembershipCards(firestore, pg, uidToUuid, membershipMap);
  await migrateCounters(firestore, pg);
  await migrateStats(firestore, pg);
  await migrateAuditLog(firestore, pg, uidToUuid);

  // Verify row counts
  await verifyMigration(firestore, pg);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nMigration completed in ${elapsed}s\n`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logError(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

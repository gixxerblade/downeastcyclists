import {readFileSync} from 'node:fs';

import {PGlite} from '@electric-sql/pglite';
import {eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {Effect} from 'effect';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

import * as schema from '@/src/db/schema';
import {createStatsMethods} from '@/src/lib/effect/database-stats.methods';

const client = new PGlite();
const db = drizzle(client, {schema});
const methods = createStatsMethods(db);
const date = (value: string) => new Date(`${value}T00:00:00Z`);

async function user(email = 'member@example.com') {
  const [row] = await db.insert(schema.users).values({firebaseUid: email, email}).returning();
  return row;
}

async function term(
  userId: string,
  start: string,
  end: string,
  status: typeof schema.memberships.$inferInsert.status = 'active',
) {
  const [row] = await db
    .insert(schema.memberships)
    .values({
      userId,
      startDate: date(start),
      endDate: date(end),
      status,
      planType: 'individual',
    })
    .returning();
  return row;
}

const activity = () =>
  Effect.runPromise(methods.getMembershipActivity(date('2026-04-01'), date('2026-09-21')));

beforeAll(async () => {
  await migrate(db, {migrationsFolder: 'drizzle'});
}, 30_000);
beforeEach(async () => {
  await db.delete(schema.users);
});
afterAll(async () => {
  await client.close();
});

describe('durable membership activity', () => {
  it('separates first membership starts from renewals using history before the chart window', async () => {
    const returning = await user();
    await term(returning.id, '2020-01-01', '2021-01-01');
    await term(returning.id, '2026-09-01', '2027-09-01');
    const newcomer = await user('new@example.com');
    await term(newcomer.id, '2026-09-10', '2027-09-10');
    // Duplicate membership rows must not double-count the same period.
    await term(newcomer.id, '2026-09-10', '2027-09-10');
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 1, renewals: 1}]);
  });

  it('preserves automatic renewals on the same subscription and deduplicates retries', async () => {
    const owner = await user();
    const membership = await term(owner.id, '2025-09-01', '2026-09-01');
    const renewal = {startDate: date('2026-09-01'), endDate: date('2027-09-01')};
    await db
      .update(schema.memberships)
      .set(renewal)
      .where(eq(schema.memberships.id, membership.id));
    await db
      .update(schema.memberships)
      .set(renewal)
      .where(eq(schema.memberships.id, membership.id));
    expect(await db.select().from(schema.membershipPeriods)).toHaveLength(2);
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 0, renewals: 1}]);
    // A delayed earlier-period update must not erase the renewal history.
    await db
      .update(schema.memberships)
      .set({startDate: date('2025-09-01'), endDate: date('2026-09-01')})
      .where(eq(schema.memberships.id, membership.id));
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 0, renewals: 1}]);
  });

  it('does not treat end-date extensions or overlapping date corrections as renewals', async () => {
    const owner = await user();
    const membership = await term(owner.id, '2026-09-01', '2027-09-01');
    await db
      .update(schema.memberships)
      .set({endDate: date('2027-10-01')})
      .where(eq(schema.memberships.id, membership.id));
    await db
      .update(schema.memberships)
      .set({startDate: date('2026-09-02'), endDate: date('2027-10-02')})
      .where(eq(schema.memberships.id, membership.id));
    expect(await db.select().from(schema.membershipPeriods)).toHaveLength(1);
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 1, renewals: 0}]);
  });

  it('excludes incomplete checkouts and future starts, and retains canceled history', async () => {
    const owner = await user();
    const membership = await term(owner.id, '2026-09-01', '2027-09-01', 'incomplete');
    await term((await user('future@example.com')).id, '2026-10-01', '2027-10-01');
    expect(await activity()).toEqual([]);
    await db
      .update(schema.memberships)
      .set({status: 'active'})
      .where(eq(schema.memberships.id, membership.id));
    await db
      .update(schema.memberships)
      .set({status: 'canceled'})
      .where(eq(schema.memberships.id, membership.id));
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 1, renewals: 0}]);
  });

  it('uses UTC month boundaries', async () => {
    const owner = await user();
    await db.insert(schema.memberships).values({
      userId: owner.id,
      planType: 'family',
      status: 'active',
      startDate: new Date('2026-08-31T20:00:00-04:00'),
      endDate: date('2027-09-01'),
    });
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 1, renewals: 0}]);
  });

  it('backfills observed terms without inventing missing historical periods', async () => {
    const owner = await user();
    await term(owner.id, '2025-09-01', '2026-09-01');
    await term(owner.id, '2026-09-01', '2027-09-01');
    await term((await user('failed@example.com')).id, '2026-09-01', '2027-09-01', 'incomplete');
    await db.delete(schema.membershipPeriods);
    const migration = readFileSync('drizzle/0008_membership_period_history.sql', 'utf8');
    const backfill = migration
      .split('--> statement-breakpoint')
      .find(
        (statement) =>
          statement.includes('INSERT INTO membership_periods') &&
          !statement.includes('CREATE FUNCTION'),
      );
    if (!backfill) throw new Error('Missing membership-period backfill');
    await client.exec(backfill);
    await client.exec(backfill);
    expect(await db.select().from(schema.membershipPeriods)).toHaveLength(2);
    expect(await activity()).toEqual([{month: '2026-09', newMembers: 0, renewals: 1}]);
  });
});

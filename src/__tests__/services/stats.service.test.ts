import {Effect} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DatabaseError} from '@/src/lib/effect/errors';
import type {MemberSearchParams, MemberWithMembership} from '@/src/lib/effect/schemas';
import {StatsService, StatsServiceLive} from '@/src/lib/effect/stats.service';

import {createTestDatabaseService, TestDatabaseLayer} from '../layers/test-layers';
import {createMockMembershipDocument, createMockUserDocument} from '../mocks/database.mock';

function member(index: number): MemberWithMembership {
  return {
    user: createMockUserDocument({id: `user_${index}`}),
    membership: createMockMembershipDocument({
      id: `membership_${index}`,
      createdAt: '2026-09-01T12:00:00.000Z',
      endDate: '2027-09-01T12:00:00.000Z',
    }),
    card: null,
  };
}

function databaseFor(
  members: MemberWithMembership[],
  activity: Array<{month: string; newMembers: number; renewals: number}> = [],
) {
  return createTestDatabaseService({
    getMembershipActivity: vi.fn(() => Effect.succeed(activity)),
    getAllMemberships: vi.fn(({page = 1, pageSize = 20}: MemberSearchParams) =>
      Effect.succeed({
        members: members.slice((page - 1) * pageSize, page * pageSize),
        total: members.length,
      }),
    ),
  });
}

function readStats(database: ReturnType<typeof createTestDatabaseService>, refresh = false) {
  return Effect.runPromise(
    Effect.flatMap(StatsService, (service) =>
      refresh ? service.refreshStats() : service.getStats(),
    ).pipe(Effect.provide(StatsServiceLive), Effect.provide(TestDatabaseLayer(database))),
  );
}

describe('membership statistics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('reconciles the 45-member export instead of counting only the first 20', async () => {
    const members = Array.from({length: 45}, (_, index) => {
      const row = member(index);
      return {
        ...row,
        membership: createMockMembershipDocument({
          ...row.membership,
          planType: index >= 35 && index <= 43 ? 'family' : 'individual',
          status: index >= 43 ? 'expired' : 'active',
          endDate: index >= 43 ? '2026-09-01T12:00:00.000Z' : '2027-09-01T12:00:00.000Z',
        }),
      };
    });
    const database = databaseFor(members, [{month: '2026-09', newMembers: 45, renewals: 0}]);
    const stats = await readStats(database);
    expect(stats).toMatchObject({
      totalMembers: 45,
      activeMembers: 43,
      expiredMembers: 2,
      canceledMembers: 0,
      individualCount: 36,
      familyCount: 9,
      yearlyRevenue: 1450,
      newMembersThisMonth: 45,
    });
    expect(stats.membershipGrowth?.at(-1)).toEqual({month: 'Sep 26', count: 45, renewals: 0});
    expect(await readStats(database, true)).toEqual(stats);
    expect(database.updateStats).toHaveBeenCalledWith(stats);
  });

  it('includes members, expirations, and growth beyond multiple full pages', async () => {
    const members = Array.from({length: 205}, (_, index) => member(index));
    members[204] = {
      ...member(204),
      membership: createMockMembershipDocument({
        createdAt: '2026-08-01T12:00:00.000Z',
        endDate: '2026-09-25T12:00:00.000Z',
      }),
    };
    const stats = await readStats(
      databaseFor(members, [
        {month: '2026-08', newMembers: 1, renewals: 2},
        {month: '2026-09', newMembers: 204, renewals: 3},
      ]),
    );
    expect(stats.totalMembers).toBe(205);
    expect(stats.activeMembers).toBe(205);
    expect(stats.expiringSoonMembers).toBe(1);
    expect(stats.newMembersThisMonth).toBe(204);
    expect(stats.renewalsThisMonth).toBe(3);
    expect(stats.membershipGrowth?.slice(-2)).toEqual([
      {month: 'Aug 26', count: 1, renewals: 2},
      {month: 'Sep 26', count: 204, renewals: 3},
    ]);
  });

  it('treats a past end date as expired and excludes it from estimated revenue', async () => {
    const stats = await readStats(
      databaseFor([
        {
          ...member(0),
          membership: createMockMembershipDocument({
            status: 'active',
            endDate: '2026-09-19T12:00:00.000Z',
          }),
        },
      ]),
    );
    expect(stats).toMatchObject({
      totalMembers: 1,
      activeMembers: 0,
      expiredMembers: 1,
      yearlyRevenue: 0,
    });
  });

  it('estimates standard annual dues only for current active plans', async () => {
    const statuses = [
      'active',
      'active',
      'complimentary',
      'legacy',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
    ] as const;
    const members = statuses.map((status, index) => ({
      ...member(index),
      membership: createMockMembershipDocument({
        status,
        planType: index === 1 ? 'family' : 'individual',
      }),
    }));
    const stats = await readStats(databaseFor(members));
    expect(stats.yearlyRevenue).toBe(80);
  });

  it('propagates missing activity history instead of pretending there were zero renewals', async () => {
    const database = createTestDatabaseService({
      getMembershipActivity: () =>
        Effect.fail(new DatabaseError({code: 'MISSING_HISTORY', message: 'History unavailable'})),
    });
    await expect(readStats(database)).rejects.toThrow('History unavailable');
  });

  it('reports an empty membership list as zero', async () => {
    const stats = await readStats(databaseFor([]));
    expect(stats).toMatchObject({totalMembers: 0, activeMembers: 0, yearlyRevenue: 0});
    expect(stats.membershipGrowth?.every((month) => month.count === 0)).toBe(true);
  });

  it.each([false, true])(
    'does not return or save misleading totals when a later page fails (refresh=%s)',
    async (refresh) => {
      const database = createTestDatabaseService({
        getAllMemberships: ({page = 1}) =>
          page === 1
            ? Effect.succeed({
                members: Array.from({length: 100}, (_, index) => member(index)),
                total: 101,
              })
            : Effect.fail(
                new DatabaseError({code: 'UNAVAILABLE', message: 'Database unavailable'}),
              ),
      });
      await expect(readStats(database, refresh)).rejects.toThrow('Database unavailable');
      expect(database.updateStats).not.toHaveBeenCalled();
    },
  );
});

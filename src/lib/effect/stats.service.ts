import {Context, Effect, Layer, pipe} from 'effect';

import {DatabaseService} from './database.service';
import {DatabaseError} from './errors';
import type {MembershipStats} from './schemas';

// Service interface
export interface StatsService {
  readonly getStats: () => Effect.Effect<MembershipStats, DatabaseError>;

  readonly refreshStats: () => Effect.Effect<MembershipStats, DatabaseError>;

  readonly incrementStat: (
    stat: keyof Omit<MembershipStats, 'updatedAt'>,
    amount?: number,
  ) => Effect.Effect<void, DatabaseError>;

  readonly decrementStat: (
    stat: keyof Omit<MembershipStats, 'updatedAt'>,
    amount?: number,
  ) => Effect.Effect<void, DatabaseError>;
}

// Service tag
export const StatsService = Context.GenericTag<StatsService>('StatsService');

// Default stats
const defaultStats: MembershipStats = {
  totalMembers: 0,
  activeMembers: 0,
  expiredMembers: 0,
  canceledMembers: 0,
  individualCount: 0,
  familyCount: 0,
  monthlyRevenue: 0,
  yearlyRevenue: 0,
  expiringSoonMembers: 0,
  newMembersThisMonth: 0,
  membershipGrowth: [],
  updatedAt: new Date().toISOString(),
};

const toDate = (value: unknown) => (value instanceof Date ? value : new Date(value as string));

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', {month: 'short', year: '2-digit'});

const getLastSixMonths = () => {
  const now = new Date();
  return Array.from({length: 6}, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: getMonthKey(date),
      label: getMonthLabel(date),
    };
  });
};

// Implementation
const make = Effect.gen(function* () {
  const db = yield* DatabaseService;

  const calculateStats = () =>
    Effect.gen(function* () {
      const {members, total} = yield* db.getAllMemberships({});
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastSixMonths = getLastSixMonths();

      return {
        totalMembers: total,
        activeMembers: members.filter(
          (m) => m.membership?.status === 'active' || m.membership?.status === 'trialing',
        ).length,
        expiredMembers: members.filter((m) => {
          if (!m.membership) return false;
          const endDate = toDate(m.membership.endDate);
          return endDate < now && m.membership.status !== 'canceled';
        }).length,
        canceledMembers: members.filter((m) => m.membership?.status === 'canceled').length,
        individualCount: members.filter((m) => m.membership?.planType === 'individual').length,
        familyCount: members.filter((m) => m.membership?.planType === 'family').length,
        monthlyRevenue: 0,
        yearlyRevenue: members.reduce((sum, m) => {
          if (m.membership?.status !== 'active') return sum;
          return sum + (m.membership.planType === 'family' ? 50 : 30);
        }, 0),
        expiringSoonMembers: members.filter((m) => {
          if (!m.membership) return false;
          if (m.membership.status !== 'active' && m.membership.status !== 'trialing') return false;
          const endDate = toDate(m.membership.endDate);
          return endDate >= now && endDate <= thirtyDaysFromNow;
        }).length,
        newMembersThisMonth: members.filter((m) => {
          if (!m.membership) return false;
          const createdAt = toDate(m.membership.createdAt);
          return createdAt >= currentMonthStart && createdAt <= now;
        }).length,
        membershipGrowth: lastSixMonths.map((month) => ({
          month: month.label,
          count: members.filter((m) => {
            if (!m.membership) return false;
            return getMonthKey(toDate(m.membership.createdAt)) === month.key;
          }).length,
        })),
        updatedAt: new Date().toISOString(),
      } satisfies MembershipStats;
    });

  return StatsService.of({
    getStats: () => pipe(calculateStats(), Effect.catchAll(() => Effect.succeed(defaultStats))),

    // Force recalculation from all memberships
    refreshStats: () =>
      Effect.gen(function* () {
        const stats = yield* calculateStats();

        yield* db.updateStats(stats);

        return stats;
      }),

    incrementStat: (stat, amount = 1) =>
      pipe(
        db.getStats(),
        Effect.flatMap((current) =>
          db.updateStats({
            [stat]: ((current?.[stat] as number) || 0) + amount,
          }),
        ),
      ),

    decrementStat: (stat, amount = 1) =>
      pipe(
        db.getStats(),
        Effect.flatMap((current) =>
          db.updateStats({
            [stat]: Math.max(0, ((current?.[stat] as number) || 0) - amount),
          }),
        ),
      ),
  });
});

// Live layer
export const StatsServiceLive = Layer.effect(StatsService, make);

import {Context, Effect, Layer, pipe} from 'effect';

import {getAnnualPriceForPlanType} from '../membership-plans-config';
import {getEffectiveMembershipStatus, isCurrentMembershipStatus} from '../membership-status';

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

const toDate = (value: unknown) => (value instanceof Date ? value : new Date(value as string));

const getMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', {month: 'short', year: '2-digit', timeZone: 'UTC'});

const getLastSixMonths = (now: Date) => {
  return Array.from({length: 6}, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
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
      // The member list is paginated, including when no filters are supplied.
      // Read every page before calculating any of the dashboard statistics.
      const pageSize = 100;
      const firstPage = yield* db.getAllMemberships({page: 1, pageSize});
      const members = [...firstPage.members];
      for (let page = 2; (page - 1) * pageSize < firstPage.total; page++) {
        const nextPage = yield* db.getAllMemberships({page, pageSize});
        members.push(...nextPage.members);
      }
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const lastSixMonths = getLastSixMonths(now);
      const activity = yield* db.getMembershipActivity(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)),
        now,
      );
      const activityByMonth = new Map(activity.map((month) => [month.month, month]));

      return {
        totalMembers: members.length,
        activeMembers: members.filter((m) =>
          isCurrentMembershipStatus(m.membership?.status, m.membership?.endDate, now),
        ).length,
        expiredMembers: members.filter(
          (m) =>
            m.membership &&
            getEffectiveMembershipStatus(m.membership.status, m.membership.endDate, now) ===
              'expired',
        ).length,
        canceledMembers: members.filter((m) => m.membership?.status === 'canceled').length,
        individualCount: members.filter((m) => m.membership?.planType === 'individual').length,
        familyCount: members.filter((m) => m.membership?.planType === 'family').length,
        monthlyRevenue: 0,
        yearlyRevenue: members.reduce((sum, m) => {
          if (
            m.membership?.status !== 'active' ||
            !isCurrentMembershipStatus(m.membership.status, m.membership.endDate, now)
          )
            return sum;
          return sum + getAnnualPriceForPlanType(m.membership.planType);
        }, 0),
        expiringSoonMembers: members.filter((m) => {
          if (!m.membership) return false;
          if (!isCurrentMembershipStatus(m.membership.status, m.membership.endDate, now)) {
            return false;
          }
          const endDate = toDate(m.membership.endDate);
          return endDate >= now && endDate <= thirtyDaysFromNow;
        }).length,
        newMembersThisMonth: activityByMonth.get(getMonthKey(now))?.newMembers ?? 0,
        renewalsThisMonth: activityByMonth.get(getMonthKey(now))?.renewals ?? 0,
        membershipGrowth: lastSixMonths.map((month) => ({
          month: month.label,
          count: activityByMonth.get(month.key)?.newMembers ?? 0,
          renewals: activityByMonth.get(month.key)?.renewals ?? 0,
        })),
        updatedAt: new Date().toISOString(),
      } satisfies MembershipStats;
    });

  return StatsService.of({
    getStats: calculateStats,

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

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
  updatedAt: new Date().toISOString(),
};

// Implementation
const make = Effect.gen(function* () {
  const db = yield* DatabaseService;

  return StatsService.of({
    // Get cached stats or return defaults
    getStats: () =>
      pipe(
        db.getStats(),
        Effect.map((stats) => stats ?? defaultStats),
      ),

    // Force recalculation from all memberships
    refreshStats: () =>
      Effect.gen(function* () {
        const {members, total} = yield* db.getAllMemberships({});

        const stats: MembershipStats = {
          totalMembers: total,
          activeMembers: members.filter(
            (m) => m.membership?.status === 'active' || m.membership?.status === 'trialing',
          ).length,
          expiredMembers: members.filter((m) => {
            if (!m.membership) return false;
            // Dates are ISO strings from Postgres
            const endDate = new Date(m.membership.endDate as string);
            return endDate < new Date() && m.membership.status !== 'canceled';
          }).length,
          canceledMembers: members.filter((m) => m.membership?.status === 'canceled').length,
          individualCount: members.filter((m) => m.membership?.planType === 'individual').length,
          familyCount: members.filter((m) => m.membership?.planType === 'family').length,
          monthlyRevenue: 0, // Would need to fetch from Stripe
          yearlyRevenue: members.reduce((sum, m) => {
            if (m.membership?.status !== 'active') return sum;
            return sum + (m.membership.planType === 'family' ? 50 : 30);
          }, 0),
          updatedAt: new Date().toISOString(),
        };

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

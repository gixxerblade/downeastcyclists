import {Context, Effect, Layer, pipe} from 'effect';

import {FirestoreError} from './errors';
import {FirestoreService} from './firestore.service';
import type {MembershipStats} from './schemas';

// Service interface
export interface StatsService {
  readonly getStats: () => Effect.Effect<MembershipStats, FirestoreError>;

  readonly refreshStats: () => Effect.Effect<MembershipStats, FirestoreError>;

  readonly incrementStat: (
    stat: keyof Omit<MembershipStats, 'updatedAt'>,
    amount?: number,
  ) => Effect.Effect<void, FirestoreError>;

  readonly decrementStat: (
    stat: keyof Omit<MembershipStats, 'updatedAt'>,
    amount?: number,
  ) => Effect.Effect<void, FirestoreError>;
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
  const firestore = yield* FirestoreService;

  return StatsService.of({
    // Get cached stats or return defaults
    getStats: () =>
      pipe(
        firestore.getStats(),
        Effect.map((stats) => stats ?? defaultStats),
      ),

    // Force recalculation from all memberships
    refreshStats: () =>
      Effect.gen(function* () {
        const {members, total} = yield* firestore.getAllMemberships({});

        const stats: MembershipStats = {
          totalMembers: total,
          activeMembers: members.filter(
            (m) => m.membership?.status === 'active' || m.membership?.status === 'trialing',
          ).length,
          expiredMembers: members.filter((m) => {
            if (!m.membership) return false;
            const endDate = m.membership.endDate?.toDate?.()
              ? m.membership.endDate.toDate()
              : new Date(m.membership.endDate as unknown as string);
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

        yield* firestore.updateStats(stats);

        return stats;
      }),

    incrementStat: (stat, amount = 1) =>
      pipe(
        firestore.getStats(),
        Effect.flatMap((current) =>
          firestore.updateStats({
            [stat]: ((current?.[stat] as number) || 0) + amount,
          }),
        ),
      ),

    decrementStat: (stat, amount = 1) =>
      pipe(
        firestore.getStats(),
        Effect.flatMap((current) =>
          firestore.updateStats({
            [stat]: Math.max(0, ((current?.[stat] as number) || 0) - amount),
          }),
        ),
      ),
  });
});

// Live layer
export const StatsServiceLive = Layer.effect(StatsService, make);

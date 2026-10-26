import {Effect, Layer} from 'effect';
import {describe, expect, it, vi} from 'vitest';

import {AdminService, AdminServiceLive} from '@/src/lib/effect/admin.service';
import {StatsService} from '@/src/lib/effect/stats.service';

import {
  createTestAuthService,
  createTestCardService,
  createTestDatabaseService,
  createTestEmailService,
  createTestStripeService,
  TestAuthLayer,
  TestCardLayer,
  TestDatabaseLayer,
  TestEmailLayer,
  TestStripeLayer,
} from '../layers/test-layers';
import {createMockMembershipDocument, createMockUserDocument} from '../mocks/database.mock';

function setup(autoRenew: boolean) {
  const membership = createMockMembershipDocument({autoRenew});
  const user = createMockUserDocument();
  const database = createTestDatabaseService({
    getUser: vi.fn(() => Effect.succeed(user)),
    getActiveMembership: vi.fn(() => Effect.succeed(membership)),
    getExpiringMemberships: vi.fn(() =>
      Effect.succeed([{user, membership, card: null, renewalEmail: null}]),
    ),
  });
  const email = createTestEmailService();
  const dependencies = Layer.mergeAll(
    TestAuthLayer(createTestAuthService()),
    TestCardLayer(createTestCardService()),
    TestDatabaseLayer(database),
    TestEmailLayer(email),
    TestStripeLayer(createTestStripeService()),
    Layer.succeed(StatsService, {
      getStats: () => Effect.die('Unused'),
      refreshStats: () => Effect.die('Unused'),
      incrementStat: () => Effect.die('Unused'),
      decrementStat: () => Effect.die('Unused'),
    }),
  );
  return {user, database, email, layer: Layer.provide(AdminServiceLive, dependencies)};
}

describe('admin renewal email eligibility', () => {
  it.each([false, true])(
    'blocks automatic renewals before sending or logging (resend: %s)',
    async (resend) => {
      const {user, database, email, layer} = setup(true);
      const result = await Effect.runPromise(
        Effect.flatMap(AdminService, (admin) =>
          admin.sendRenewalEmail(user.id, 'admin', undefined, {resend}),
        ).pipe(Effect.either, Effect.provide(layer)),
      );
      expect(result).toMatchObject({
        _tag: 'Left',
        left: {
          _tag: 'ValidationError',
          field: 'membership',
          message: expect.stringContaining('renews automatically'),
        },
      });
      expect(email.sendRenewalEmail).not.toHaveBeenCalled();
      expect(email.sendUpcomingRenewalEmail).not.toHaveBeenCalled();
      expect(database.getLatestEmailLog).not.toHaveBeenCalled();
      expect(database.logEmailEvent).not.toHaveBeenCalled();
      expect(database.logAuditEntry).not.toHaveBeenCalled();
    },
  );

  it('still sends manual renewal emails and records the delivery', async () => {
    const {user, database, email, layer} = setup(false);
    const result = await Effect.runPromise(
      Effect.flatMap(AdminService, (admin) => admin.sendRenewalEmail(user.id, 'admin')).pipe(
        Effect.provide(layer),
      ),
    );
    expect(result).toMatchObject({sent: true, alreadySent: false, deliveryType: 'send'});
    expect(email.sendRenewalEmail).toHaveBeenCalledTimes(1);
    expect(email.sendUpcomingRenewalEmail).not.toHaveBeenCalled();
    expect(database.logEmailEvent).toHaveBeenCalledTimes(1);
    expect(database.logAuditEntry).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'exposes renewal type in the report (automatic: %s)',
    async (autoRenew) => {
      const {layer} = setup(autoRenew);
      const result = await Effect.runPromise(
        Effect.flatMap(AdminService, (admin) => admin.getExpiringMemberships(30)).pipe(
          Effect.provide(layer),
        ),
      );
      expect(result).toHaveLength(1);
      expect(result[0].autoRenew).toBe(autoRenew);
    },
  );
});

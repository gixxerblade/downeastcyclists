import {Effect, Layer} from 'effect';
import {describe, expect, it, vi} from 'vitest';

import {DatabaseService} from '@/src/lib/effect/database.service';
import {EmailService} from '@/src/lib/effect/email.service';
import {sendScheduledRenewalReminders} from '@/src/lib/effect/renewal-reminders';

import {createTestDatabaseService, createTestEmailService} from '../layers/test-layers';

describe('sendScheduledRenewalReminders', () => {
  it('sends only 30/60/90 day reminders', async () => {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(now.getDate() + 30);
    const in31Days = new Date(now);
    in31Days.setDate(now.getDate() + 31);

    const databaseService = createTestDatabaseService({
      getExpiringMemberships: vi.fn(() =>
        Effect.succeed([
          {
            user: {
              id: 'user_30',
              email: 'thirty@example.com',
              name: 'Thirty',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
            membership: {
              id: 'mem_30',
              stripeSubscriptionId: 'sub_30',
              planType: 'individual' as const,
              status: 'active' as const,
              startDate: now.toISOString(),
              endDate: in30Days.toISOString(),
              autoRenew: false,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
            card: null,
          },
          {
            user: {
              id: 'user_31',
              email: 'thirtyone@example.com',
              name: 'Thirty One',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
            membership: {
              id: 'mem_31',
              stripeSubscriptionId: 'sub_31',
              planType: 'family' as const,
              status: 'active' as const,
              startDate: now.toISOString(),
              endDate: in31Days.toISOString(),
              autoRenew: false,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
            card: null,
          },
        ]),
      ),
    });
    const emailService = createTestEmailService();
    const layer = Layer.mergeAll(
      Layer.succeed(DatabaseService, databaseService),
      Layer.succeed(EmailService, emailService),
    );

    const result = await Effect.runPromise(
      sendScheduledRenewalReminders.pipe(Effect.provide(layer)),
    );

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(emailService.sendRenewalEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendRenewalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'thirty@example.com',
        daysUntilExpiration: 30,
      }),
    );
  });
});

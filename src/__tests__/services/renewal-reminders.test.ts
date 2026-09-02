import {Effect, Layer} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DatabaseService} from '@/src/lib/effect/database.service';
import {EmailService} from '@/src/lib/effect/email.service';
import {EmailError} from '@/src/lib/effect/errors';
import {sendScheduledRenewalReminders} from '@/src/lib/effect/renewal-reminders';

import {createTestDatabaseService, createTestEmailService} from '../layers/test-layers';

const NOW = new Date('2026-09-02T12:00:00.000Z');

function createExpiringMember({
  id,
  daysUntilExpiration,
  autoRenew,
}: {
  id: string;
  daysUntilExpiration: number;
  autoRenew: boolean;
}) {
  const endDate = new Date(NOW.getTime() + daysUntilExpiration * 24 * 60 * 60 * 1000);

  return {
    user: {
      id: `user_${id}`,
      email: `${id}@example.com`,
      name: id,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    membership: {
      id: `mem_${id}`,
      stripeSubscriptionId: `sub_${id}`,
      planType: 'individual' as const,
      status: 'active' as const,
      startDate: NOW.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    card: null,
    renewalEmail: null,
  };
}

describe('sendScheduledRenewalReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips auto-renewing members at 90 and 60 days without logging email events', async () => {
    const databaseService = createTestDatabaseService({
      getExpiringMemberships: vi.fn(() =>
        Effect.succeed([
          createExpiringMember({id: 'auto_90', daysUntilExpiration: 90, autoRenew: true}),
          createExpiringMember({id: 'auto_60', daysUntilExpiration: 60, autoRenew: true}),
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

    expect(result).toEqual({sent: 0, skipped: 2, errors: []});
    expect(emailService.sendRenewalEmail).not.toHaveBeenCalled();
    expect(emailService.sendUpcomingRenewalEmail).not.toHaveBeenCalled();
    expect(databaseService.logEmailEvent).not.toHaveBeenCalled();
    expect(databaseService.logAuditEntry).not.toHaveBeenCalled();
  });

  it('sends one upcoming-renewal notice to an auto-renewing member at 30 days', async () => {
    const databaseService = createTestDatabaseService({
      getExpiringMemberships: vi.fn(() =>
        Effect.succeed([
          createExpiringMember({id: 'auto_30', daysUntilExpiration: 30, autoRenew: true}),
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

    expect(result).toEqual({sent: 1, skipped: 0, errors: []});
    expect(emailService.sendRenewalEmail).not.toHaveBeenCalled();
    expect(emailService.sendUpcomingRenewalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'auto_30@example.com',
        manageMembershipUrl: 'http://localhost:3000/member',
        planName: 'Individual Annual Membership',
        planPrice: 30,
        idempotencyKey: 'upcoming-renewal/30/user_auto_30/2026-09-02',
      }),
    );
    expect(databaseService.logEmailEvent).toHaveBeenCalledWith(
      'user_auto_30',
      expect.objectContaining({
        emailType: 'membership_upcoming_renewal',
        deliveryType: 'automated',
        status: 'sent',
        idempotencyKey: 'upcoming-renewal/30/user_auto_30/2026-09-02',
      }),
    );
    expect(databaseService.logAuditEntry).toHaveBeenCalledWith(
      'user_auto_30',
      'AUTOMATED_UPCOMING_RENEWAL_EMAIL_SENT',
      expect.objectContaining({performedBy: 'system', reminderDays: 30}),
    );
  });

  it('logs a failed upcoming-renewal email event and accumulates the error', async () => {
    const databaseService = createTestDatabaseService({
      getExpiringMemberships: vi.fn(() =>
        Effect.succeed([
          createExpiringMember({id: 'auto_failure', daysUntilExpiration: 30, autoRenew: true}),
        ]),
      ),
    });
    const emailService = createTestEmailService({
      sendUpcomingRenewalEmail: vi.fn(() =>
        Effect.fail(
          new EmailError({
            code: 'SEND_UPCOMING_RENEWAL_FAILED',
            message: 'Resend unavailable',
          }),
        ),
      ),
    });
    const layer = Layer.mergeAll(
      Layer.succeed(DatabaseService, databaseService),
      Layer.succeed(EmailService, emailService),
    );

    const result = await Effect.runPromise(
      sendScheduledRenewalReminders.pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({
      sent: 0,
      skipped: 0,
      errors: [{email: 'auto_failure@example.com', message: 'Resend unavailable'}],
    });
    expect(databaseService.logEmailEvent).toHaveBeenCalledWith(
      'user_auto_failure',
      expect.objectContaining({
        emailType: 'membership_upcoming_renewal',
        status: 'failed',
        errorMessage: 'Resend unavailable',
      }),
    );
    expect(databaseService.logAuditEntry).not.toHaveBeenCalled();
  });

  it('keeps the manual 90/60/30 renewal flow unchanged', async () => {
    const databaseService = createTestDatabaseService({
      getExpiringMemberships: vi.fn(() =>
        Effect.succeed(
          [90, 60, 30].map((daysUntilExpiration) =>
            createExpiringMember({
              id: `manual_${daysUntilExpiration}`,
              daysUntilExpiration,
              autoRenew: false,
            }),
          ),
        ),
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

    expect(result).toEqual({sent: 3, skipped: 0, errors: []});
    expect(emailService.sendRenewalEmail).toHaveBeenCalledTimes(3);
    expect(emailService.sendUpcomingRenewalEmail).not.toHaveBeenCalled();
    for (const daysUntilExpiration of [90, 60, 30]) {
      expect(emailService.sendRenewalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: `manual_${daysUntilExpiration}@example.com`,
          daysUntilExpiration,
          renewalUrl: expect.stringMatching(/\/renew\?token=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/),
        }),
      );
    }
    expect(databaseService.logEmailEvent).toHaveBeenCalledTimes(3);
    expect(databaseService.logEmailEvent).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({emailType: 'membership_renewal', status: 'sent'}),
    );
    expect(databaseService.logAuditEntry).toHaveBeenCalledTimes(3);
    expect(databaseService.logAuditEntry).toHaveBeenCalledWith(
      expect.any(String),
      'AUTOMATED_RENEWAL_EMAIL_SENT',
      expect.any(Object),
    );
  });
});

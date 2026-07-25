import {Effect} from 'effect';

import {getPlanNameForType} from '../membership-plans-config';
import {
  getMembershipDaysUntilExpiration,
  isRenewalReminderDay,
  parseMembershipDate,
} from '../membership-status';
import {
  buildRenewalEmailCampaignKey,
  getRenewalEmailSubject,
  RENEWAL_EMAIL_TYPE,
} from '../renewal-email';
import {buildRenewalUrl} from '../renewal-link';

import {DatabaseService} from './database.service';
import {EmailService} from './email.service';

export interface RenewalReminderResult {
  sent: number;
  skipped: number;
  errors: Array<{email: string; message: string}>;
}

export const sendScheduledRenewalReminders = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const email = yield* EmailService;
  const now = new Date();
  const members = yield* db.getExpiringMemberships(90);
  const initial: RenewalReminderResult = {sent: 0, skipped: 0, errors: []};

  return yield* Effect.reduce(members, initial, (result, member) =>
    Effect.gen(function* () {
      if (!member.user || !member.membership) {
        return {...result, skipped: result.skipped + 1};
      }

      const daysUntilExpiration = getMembershipDaysUntilExpiration(member.membership.endDate, now);
      if (!isRenewalReminderDay(daysUntilExpiration)) {
        return {...result, skipped: result.skipped + 1};
      }

      const expirationDate = parseMembershipDate(member.membership.endDate)?.toISOString();
      const campaignKey = buildRenewalEmailCampaignKey(member.user.id, member.membership);
      const idempotencyKey = `renewal-reminder/${daysUntilExpiration}/${member.user.id}/${now.toISOString().slice(0, 10)}`;
      const subject = getRenewalEmailSubject(daysUntilExpiration);
      const sendResult = yield* email
        .sendRenewalEmail({
          to: member.user.email,
          name: member.user.name,
          renewalUrl: buildRenewalUrl(member.user.id),
          expirationDate,
          planName: getPlanNameForType(member.membership.planType),
          daysUntilExpiration,
          idempotencyKey,
        })
        .pipe(Effect.either);

      if (sendResult._tag === 'Left') {
        yield* db.logEmailEvent(member.user.id, {
          membershipId: member.membership.id,
          emailType: RENEWAL_EMAIL_TYPE,
          deliveryType: 'automated',
          campaignKey,
          recipientEmail: member.user.email,
          subject,
          status: 'failed',
          idempotencyKey,
          sentBy: 'system',
          errorMessage: sendResult.left.message,
        });

        return {
          ...result,
          errors: [...result.errors, {email: member.user.email, message: sendResult.left.message}],
        };
      }

      yield* db.logEmailEvent(member.user.id, {
        membershipId: member.membership.id,
        emailType: RENEWAL_EMAIL_TYPE,
        deliveryType: 'automated',
        campaignKey,
        recipientEmail: member.user.email,
        subject,
        status: 'sent',
        idempotencyKey,
        sentBy: 'system',
      });

      yield* db.logAuditEntry(member.user.id, 'AUTOMATED_RENEWAL_EMAIL_SENT', {
        performedBy: 'system',
        targetEmail: member.user.email,
        deliveryType: 'automated',
        campaignKey,
        reminderDays: daysUntilExpiration,
        timestamp: new Date().toISOString(),
      });

      return {...result, sent: result.sent + 1};
    }),
  );
});

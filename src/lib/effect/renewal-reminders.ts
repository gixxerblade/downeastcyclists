import {Effect} from 'effect';

import {getAnnualPriceForPlanType, getPlanNameForType} from '../membership-plans-config';
import {
  getMembershipDaysUntilExpiration,
  isRenewalReminderDay,
  parseMembershipDate,
} from '../membership-status';
import {
  buildRenewalEmailCampaignKey,
  getRenewalEmailSubject,
  getUpcomingRenewalEmailSubject,
  RENEWAL_EMAIL_TYPE,
  UPCOMING_RENEWAL_EMAIL_TYPE,
} from '../renewal-email';
import {buildRenewalUrl} from '../renewal-link';
import {getSiteUrl} from '../site-url';

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

      if (member.membership.autoRenew && daysUntilExpiration !== 30) {
        return {...result, skipped: result.skipped + 1};
      }

      const expirationDate = parseMembershipDate(member.membership.endDate)?.toISOString();
      if (!expirationDate) {
        return {...result, skipped: result.skipped + 1};
      }

      const isUpcomingRenewal = member.membership.autoRenew;
      const campaignKey = buildRenewalEmailCampaignKey(member.user.id, member.membership);
      const runDate = now.toISOString().slice(0, 10);
      const idempotencyKey = isUpcomingRenewal
        ? `upcoming-renewal/30/${member.user.id}/${runDate}`
        : `renewal-reminder/${daysUntilExpiration}/${member.user.id}/${runDate}`;
      const subject = isUpcomingRenewal
        ? getUpcomingRenewalEmailSubject(expirationDate)
        : getRenewalEmailSubject(daysUntilExpiration);
      const emailType = isUpcomingRenewal ? UPCOMING_RENEWAL_EMAIL_TYPE : RENEWAL_EMAIL_TYPE;
      const sendResult = yield* (
        isUpcomingRenewal
          ? email.sendUpcomingRenewalEmail({
              to: member.user.email,
              name: member.user.name,
              manageMembershipUrl: new URL('/member', getSiteUrl()).toString(),
              renewalDate: expirationDate,
              planName: getPlanNameForType(member.membership.planType),
              planPrice: getAnnualPriceForPlanType(member.membership.planType),
              idempotencyKey,
            })
          : email.sendRenewalEmail({
              to: member.user.email,
              name: member.user.name,
              renewalUrl: buildRenewalUrl(member.user.id),
              expirationDate,
              planName: getPlanNameForType(member.membership.planType),
              daysUntilExpiration,
              idempotencyKey,
            })
      ).pipe(Effect.either);

      if (sendResult._tag === 'Left') {
        yield* db.logEmailEvent(member.user.id, {
          membershipId: member.membership.id,
          emailType,
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
        emailType,
        deliveryType: 'automated',
        campaignKey,
        recipientEmail: member.user.email,
        subject,
        status: 'sent',
        idempotencyKey,
        sentBy: 'system',
      });

      yield* db.logAuditEntry(
        member.user.id,
        isUpcomingRenewal
          ? 'AUTOMATED_UPCOMING_RENEWAL_EMAIL_SENT'
          : 'AUTOMATED_RENEWAL_EMAIL_SENT',
        {
          performedBy: 'system',
          targetEmail: member.user.email,
          deliveryType: 'automated',
          campaignKey,
          reminderDays: daysUntilExpiration,
          timestamp: new Date().toISOString(),
        },
      );

      return {...result, sent: result.sent + 1};
    }),
  );
});

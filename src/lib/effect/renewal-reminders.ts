import {Effect} from 'effect';

import {getPlanNameForType} from '../membership-plans-config';
import {
  getMembershipDaysUntilExpiration,
  isRenewalReminderDay,
  parseMembershipDate,
} from '../membership-status';

import {DatabaseService} from './database.service';
import {EmailService} from './email.service';

export interface RenewalReminderResult {
  sent: number;
  skipped: number;
  errors: Array<{email: string; message: string}>;
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export const sendScheduledRenewalReminders = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const email = yield* EmailService;
  const now = new Date();
  const members = yield* db.getExpiringMemberships(90);
  const renewalUrl = `${getSiteUrl()}/renew`;
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
      const sendResult = yield* email
        .sendRenewalEmail({
          to: member.user.email,
          name: member.user.name,
          renewalUrl,
          expirationDate,
          planName: getPlanNameForType(member.membership.planType),
          daysUntilExpiration,
          idempotencyKey: `renewal-reminder/${daysUntilExpiration}/${member.user.id}/${now.toISOString().slice(0, 10)}`,
        })
        .pipe(Effect.either);

      if (sendResult._tag === 'Left') {
        return {
          ...result,
          errors: [...result.errors, {email: member.user.email, message: sendResult.left.message}],
        };
      }

      return {...result, sent: result.sent + 1};
    }),
  );
});

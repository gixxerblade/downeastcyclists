export const RENEWAL_EMAIL_TYPE = 'membership_renewal';
export const UPCOMING_RENEWAL_EMAIL_TYPE = 'membership_upcoming_renewal';

export function buildRenewalEmailCampaignKey(
  userId: string,
  membership: {id?: string; endDate?: unknown} | null | undefined,
) {
  if (membership?.id) {
    return `membership/${membership.id}`;
  }

  if (membership?.endDate) {
    return `membership-end/${new Date(membership.endDate as string).toISOString().slice(0, 10)}`;
  }

  return `user/${userId}/manual-renewal`;
}

export function getRenewalEmailSubject(daysUntilExpiration?: 30 | 60 | 90) {
  return daysUntilExpiration
    ? `Your Down East Cyclists membership renews in ${daysUntilExpiration} days`
    : 'Renew your Down East Cyclists membership';
}

export function getUpcomingRenewalEmailSubject(renewalDate: string | undefined) {
  const parsedRenewalDate = renewalDate ? new Date(renewalDate) : null;
  const formattedRenewalDate =
    parsedRenewalDate && !Number.isNaN(parsedRenewalDate.getTime())
      ? parsedRenewalDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : 'your renewal date';

  return `Your DEC membership renews on ${formattedRenewalDate}`;
}

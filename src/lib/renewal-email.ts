export const RENEWAL_EMAIL_TYPE = 'membership_renewal';

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

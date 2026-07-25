import {describe, expect, it} from 'vitest';

import {
  getEffectiveMembershipStatus,
  getMembershipDaysUntilExpiration,
  isCurrentMembershipStatus,
  isRenewalReminderDay,
} from '@/src/lib/membership-status';

describe('membership status helpers', () => {
  const now = new Date('2026-07-25T12:00:00.000Z');

  it('marks date-expired active records as expired', () => {
    expect(getEffectiveMembershipStatus('active', '2026-05-28T00:00:00.000Z', now)).toBe('expired');
  });

  it('keeps current active records active', () => {
    expect(getEffectiveMembershipStatus('active', '2027-05-28T00:00:00.000Z', now)).toBe('active');
  });

  it('treats expired records as not current', () => {
    expect(isCurrentMembershipStatus('active', '2026-05-28T00:00:00.000Z', now)).toBe(false);
    expect(isCurrentMembershipStatus('active', '2027-05-28T00:00:00.000Z', now)).toBe(true);
  });

  it('recognizes only the configured reminder days', () => {
    expect(getMembershipDaysUntilExpiration('2026-08-24T12:00:00.000Z', now)).toBe(30);
    expect(isRenewalReminderDay(30)).toBe(true);
    expect(isRenewalReminderDay(29)).toBe(false);
  });
});

import {describe, expect, it} from 'vitest';

import {
  getDashboardCapabilities,
  hasCurrentMembership,
  hasDashboardCapability,
} from '@/src/lib/access-control';

describe('dashboard capabilities', () => {
  it('allows organizers to use reporting and trail tools', () => {
    expect(hasDashboardCapability('organizer', 'members:read')).toBe(true);
    expect(hasDashboardCapability('organizer', 'members:export')).toBe(true);
    expect(hasDashboardCapability('organizer', 'members:password-reset')).toBe(true);
    expect(hasDashboardCapability('organizer', 'stats:refresh')).toBe(true);
    expect(hasDashboardCapability('organizer', 'trails:update')).toBe(true);
  });

  it('denies organizers admin-only capabilities', () => {
    expect(hasDashboardCapability('organizer', 'members:write')).toBe(false);
    expect(hasDashboardCapability('organizer', 'members:payments')).toBe(false);
    expect(hasDashboardCapability('organizer', 'members:refund')).toBe(false);
    expect(hasDashboardCapability('organizer', 'members:import')).toBe(false);
    expect(hasDashboardCapability('organizer', 'reconciliation:run')).toBe(false);
    expect(hasDashboardCapability('organizer', 'organizers:manage')).toBe(false);
  });

  it('gives members no dashboard capabilities', () => {
    expect(getDashboardCapabilities('member')).toEqual([]);
  });

  it('gives the administrator every organizer and admin capability', () => {
    expect(hasDashboardCapability('admin', 'members:read')).toBe(true);
    expect(hasDashboardCapability('admin', 'members:write')).toBe(true);
    expect(hasDashboardCapability('admin', 'reconciliation:run')).toBe(true);
    expect(hasDashboardCapability('admin', 'organizers:manage')).toBe(true);
  });

  it('requires a paid or trialing membership with a current end date', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');

    expect(hasCurrentMembership({status: 'active', endDate: '2026-07-26T12:00:00.000Z'}, now)).toBe(
      true,
    );
    expect(
      hasCurrentMembership({status: 'past_due', endDate: '2026-07-26T12:00:00.000Z'}, now),
    ).toBe(false);
    expect(hasCurrentMembership({status: 'active', endDate: '2026-07-24T12:00:00.000Z'}, now)).toBe(
      false,
    );
  });
});

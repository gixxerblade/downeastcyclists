import {isCurrentMembershipStatus} from './membership-status';

export type AccessRole = 'member' | 'organizer' | 'admin';

export type StaffRole = Exclude<AccessRole, 'member'>;

interface MembershipEligibility {
  readonly status: string;
  readonly endDate: unknown;
}

export type DashboardCapability =
  | 'dashboard:view'
  | 'members:read'
  | 'members:write'
  | 'members:export'
  | 'members:audit'
  | 'members:password-reset'
  | 'members:payments'
  | 'members:refund'
  | 'members:import'
  | 'action-log:view'
  | 'stats:read'
  | 'stats:refresh'
  | 'trails:update'
  | 'reconciliation:run'
  | 'organizers:manage';

const organizerCapabilities: ReadonlySet<DashboardCapability> = new Set([
  'dashboard:view',
  'members:read',
  'members:export',
  'members:audit',
  'members:password-reset',
  'action-log:view',
  'stats:read',
  'stats:refresh',
  'trails:update',
]);

const adminCapabilities: ReadonlySet<DashboardCapability> = new Set([
  ...organizerCapabilities,
  'members:write',
  'members:payments',
  'members:refund',
  'members:import',
  'reconciliation:run',
  'organizers:manage',
]);

export interface AccessSession {
  readonly uid: string;
  readonly email?: string;
  readonly role: AccessRole;
}

export function hasDashboardCapability(role: AccessRole, capability: DashboardCapability): boolean {
  if (role === 'admin') return adminCapabilities.has(capability);
  if (role === 'organizer') return organizerCapabilities.has(capability);
  return false;
}

export function getDashboardCapabilities(role: AccessRole): DashboardCapability[] {
  if (role === 'admin') return [...adminCapabilities];
  if (role === 'organizer') return [...organizerCapabilities];
  return [];
}

export function hasCurrentMembership(
  membership: MembershipEligibility | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!membership || (membership.status !== 'active' && membership.status !== 'trialing')) {
    return false;
  }

  return isCurrentMembershipStatus(membership?.status, membership?.endDate, now);
}

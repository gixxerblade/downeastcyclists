import type {MembershipStatus} from './effect/schemas';

export type StoredMembershipStatus = Exclude<MembershipStatus, 'expired'>;

const currentStatuses = new Set<string>([
  'active',
  'trialing',
  'past_due',
  'complimentary',
  'legacy',
]);

const inactiveStatuses = new Set<string>([
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'deleted',
  'expired',
]);

export function parseMembershipDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getMembershipDaysUntilExpiration(endDate: unknown, now: Date = new Date()) {
  const parsedEndDate = parseMembershipDate(endDate);
  if (!parsedEndDate) return null;

  return Math.ceil((parsedEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isMembershipExpiredByDate(endDate: unknown, now: Date = new Date()): boolean {
  const parsedEndDate = parseMembershipDate(endDate);
  return parsedEndDate !== null && parsedEndDate < now;
}

export function getEffectiveMembershipStatus(
  status: string | null | undefined,
  endDate: unknown,
  now: Date = new Date(),
): MembershipStatus {
  const normalizedStatus = status || 'incomplete';

  if (currentStatuses.has(normalizedStatus) && isMembershipExpiredByDate(endDate, now)) {
    return 'expired';
  }

  return normalizedStatus as MembershipStatus;
}

export function isCurrentMembershipStatus(
  status: string | null | undefined,
  endDate: unknown,
  now: Date = new Date(),
): boolean {
  if (!status || inactiveStatuses.has(status)) return false;
  return currentStatuses.has(status) && !isMembershipExpiredByDate(endDate, now);
}

export function isRenewalReminderDay(
  daysUntilExpiration: number | null,
): daysUntilExpiration is 30 | 60 | 90 {
  return daysUntilExpiration === 30 || daysUntilExpiration === 60 || daysUntilExpiration === 90;
}

export function toStoredMembershipStatus(status: MembershipStatus): StoredMembershipStatus {
  switch (status) {
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'trialing':
    case 'unpaid':
    case 'deleted':
    case 'complimentary':
    case 'legacy':
      return status;
    case 'expired':
      throw new Error('Expired is date-based and cannot be stored as a membership status');
  }
}

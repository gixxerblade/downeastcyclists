import type {MembershipStatus} from './effect/schemas';

/**
 * Membership access configuration for Down East Cyclists
 *
 * Business Rules:
 * - Only Individual ($30/year) and Family ($50/year) memberships
 * - No trial periods
 * - Payment required upfront
 * - Stripe handles all payment retries automatically
 */

export type AccessLevel = 'full' | 'none';

export interface MembershipAccessConfig {
  status: MembershipStatus;
  accessLevel: AccessLevel;
  canAccessMemberContent: boolean;
  canAccessMemberDiscounts: boolean;
  showPaymentWarning: boolean;
  message?: string;
}

/**
 * Access rules for each subscription status
 *
 * Key decisions:
 * - "active": Full access - payment successful
 * - "past_due": FULL access retained - they paid for the year, Stripe is retrying
 * - "canceled": No access - subscription ended
 * - "incomplete": No access - initial payment never completed
 * - "incomplete_expired": No access - checkout session expired
 * - "unpaid": No access - all retry attempts exhausted
 * - "trialing": Not used by DEC, but treat as no access if encountered
 */
export const MEMBERSHIP_ACCESS_RULES: Record<MembershipStatus, MembershipAccessConfig> = {
  active: {
    status: 'active',
    accessLevel: 'full',
    canAccessMemberContent: true,
    canAccessMemberDiscounts: true,
    showPaymentWarning: false,
  },
  past_due: {
    status: 'past_due',
    accessLevel: 'full', // Keep access - they paid for the year, Stripe is retrying
    canAccessMemberContent: true,
    canAccessMemberDiscounts: true,
    showPaymentWarning: true,
    message:
      "Your renewal payment failed. We're retrying automatically. Please check your payment method.",
  },
  canceled: {
    status: 'canceled',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: false,
    message: 'Your membership has been canceled.',
  },
  incomplete: {
    status: 'incomplete',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: true,
    message: 'Payment could not be processed. Please try again.',
  },
  incomplete_expired: {
    status: 'incomplete_expired',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: false,
    message: 'Checkout session expired. Please start a new membership.',
  },
  unpaid: {
    status: 'unpaid',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: true,
    message: 'Payment failed after multiple attempts. Please update your payment method.',
  },
  trialing: {
    // Not used by DEC - treat as no access if somehow encountered
    status: 'trialing',
    accessLevel: 'none',
    canAccessMemberContent: false,
    canAccessMemberDiscounts: false,
    showPaymentWarning: false,
    message: 'Invalid membership status.',
  },
};

/**
 * Check if user has active membership access
 *
 * Returns true for:
 * - "active" status
 * - "past_due" status (they paid for the year, Stripe is handling retries)
 */
export function hasActiveMembershipAccess(status: MembershipStatus | null): boolean {
  if (!status) return false;

  // Active members have access
  // Past due members RETAIN access - they already paid for the current period
  return status === 'active' || status === 'past_due';
}

/**
 * Get access configuration for a membership status
 */
export function getMembershipAccessConfig(status: MembershipStatus): MembershipAccessConfig {
  return MEMBERSHIP_ACCESS_RULES[status];
}

/**
 * Check if a subscription status indicates a completed initial payment
 * Used to decide whether to create a membership record
 */
export function isPaymentCompleted(status: string): boolean {
  // Only create membership records for these statuses
  return status === 'active' || status === 'past_due';
}

/**
 * Check if subscription status indicates payment is pending/failed
 */
export function isPaymentPending(status: string): boolean {
  return status === 'incomplete' || status === 'incomplete_expired';
}

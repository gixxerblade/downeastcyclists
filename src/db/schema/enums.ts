import {pgEnum} from 'drizzle-orm/pg-core';

export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'unpaid',
  'deleted',
  'complimentary',
  'legacy',
]);

export const planTypeEnum = pgEnum('plan_type', ['individual', 'family']);

export const webhookStatusEnum = pgEnum('webhook_status', ['processing', 'completed', 'failed']);

export const planIntervalEnum = pgEnum('plan_interval', ['year', 'month']);

export const auditActionEnum = pgEnum('audit_action', [
  'MEMBER_CREATED',
  'MEMBER_UPDATED',
  'MEMBER_DELETED',
  'MEMBERSHIP_EXTENDED',
  'MEMBERSHIP_PAUSED',
  'EMAIL_CHANGED',
  'STRIPE_SYNCED',
  'REFUND_ISSUED',
  'BULK_IMPORT',
  'ADMIN_ROLE_CHANGE',
  'MEMBERSHIP_ADJUSTMENT',
  'RECONCILIATION',
]);

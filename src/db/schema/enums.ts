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
  'RENEWAL_EMAIL_SENT',
  'RENEWAL_EMAIL_RESENT',
  'AUTOMATED_RENEWAL_EMAIL_SENT',
  'RECONCILIATION',
]);

export const trailIssueTypeEnum = pgEnum('trail_issue_type', [
  'trail_obstruction',
  'erosion_or_hole',
  'standing_water_or_drainage',
  'overgrown_vegetation',
  'damaged_feature',
  'missing_or_damaged_sign',
  'trash_or_vandalism',
  'other',
]);

export const trailIssueStatusEnum = pgEnum('trail_issue_status', [
  'new',
  'triaged',
  'assigned',
  'county_needed',
  'county_contacted',
  'in_progress',
  'resolved',
  'closed_no_action',
  'duplicate',
]);

export const trailIssuePriorityEnum = pgEnum('trail_issue_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const trailLocationSourceEnum = pgEnum('trail_location_source', [
  'browser_geolocation',
  'map_pin',
  'manual',
  'qr_prefill',
]);

export const trailIssueEventTypeEnum = pgEnum('trail_issue_event_type', [
  'created',
  'status_changed',
  'priority_changed',
  'assigned',
  'note_added',
  'county_email_generated',
  'county_email_sent',
  'resolved',
  'reopened',
]);

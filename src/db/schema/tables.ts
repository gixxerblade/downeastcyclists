import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  auditActionEnum,
  membershipStatusEnum,
  planIntervalEnum,
  planTypeEnum,
  trailIssueEventTypeEnum,
  trailIssuePriorityEnum,
  trailIssueStatusEnum,
  trailIssueTypeEnum,
  trailLocationSourceEnum,
  webhookStatusEnum,
} from './enums';

// ---------------------------------------------------------------------------
// 1. Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firebaseUid: varchar('firebase_uid', {length: 128}).notNull().unique(),
    email: varchar('email', {length: 255}).notNull().unique(),
    name: varchar('name', {length: 255}),
    phone: varchar('phone', {length: 50}),
    addressStreet: varchar('address_street', {length: 255}),
    addressCity: varchar('address_city', {length: 100}),
    addressState: varchar('address_state', {length: 50}),
    addressZip: varchar('address_zip', {length: 20}),
    stripeCustomerId: varchar('stripe_customer_id', {length: 255}),
    isOrganizer: boolean('is_organizer').notNull().default(false),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [index('users_stripe_customer_idx').on(table.stripeCustomerId)],
);

// ---------------------------------------------------------------------------
// 2. Memberships
// ---------------------------------------------------------------------------

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    stripeSubscriptionId: varchar('stripe_subscription_id', {length: 255}),
    planType: planTypeEnum('plan_type').notNull(),
    status: membershipStatusEnum('status').notNull().default('incomplete'),
    startDate: timestamp('start_date', {withTimezone: true}).notNull(),
    endDate: timestamp('end_date', {withTimezone: true}).notNull(),
    autoRenew: boolean('auto_renew').notNull().default(true),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('memberships_user_id_idx').on(table.userId),
    index('memberships_stripe_sub_idx').on(table.stripeSubscriptionId),
    index('memberships_status_end_date_idx').on(table.status, table.endDate),
    index('memberships_user_status_idx').on(table.userId, table.status),
  ],
);

// ---------------------------------------------------------------------------
// 3. Membership Cards
// ---------------------------------------------------------------------------

export const membershipCards = pgTable(
  'membership_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, {onDelete: 'cascade'}),
    membershipNumber: varchar('membership_number', {length: 20}).notNull().unique(),
    memberName: varchar('member_name', {length: 255}).notNull(),
    email: varchar('email', {length: 255}).notNull(),
    planType: planTypeEnum('plan_type').notNull(),
    status: membershipStatusEnum('status').notNull(),
    validFrom: timestamp('valid_from', {withTimezone: true}).notNull(),
    validUntil: timestamp('valid_until', {withTimezone: true}).notNull(),
    qrCodeData: text('qr_code_data').notNull(),
    pdfUrl: text('pdf_url'),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('membership_cards_user_id_idx').on(table.userId),
    index('membership_cards_membership_id_idx').on(table.membershipId),
  ],
);

// ---------------------------------------------------------------------------
// 4. Membership Plans
// ---------------------------------------------------------------------------

export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', {length: 100}).notNull(),
    description: text('description').notNull(),
    stripePriceId: varchar('stripe_price_id', {length: 255}).notNull(),
    price: numeric('price', {precision: 10, scale: 2}).notNull(),
    interval: planIntervalEnum('interval').notNull(),
    benefits: jsonb('benefits').notNull().$type<string[]>(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('membership_plans_stripe_price_idx').on(table.stripePriceId)],
);

// ---------------------------------------------------------------------------
// 5. Membership Counters
// ---------------------------------------------------------------------------

export const membershipCounters = pgTable(
  'membership_counters',
  {
    id: serial('id').primaryKey(),
    year: integer('year').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('membership_counters_year_idx').on(table.year)],
);

// ---------------------------------------------------------------------------
// 6. Webhook Events
// ---------------------------------------------------------------------------

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: varchar('id', {length: 255}).primaryKey(),
    type: varchar('type', {length: 100}).notNull(),
    status: webhookStatusEnum('status').notNull().default('processing'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    processedAt: timestamp('processed_at', {withTimezone: true}).defaultNow().notNull(),
    completedAt: timestamp('completed_at', {withTimezone: true}),
    failedAt: timestamp('failed_at', {withTimezone: true}),
  },
  (table) => [
    index('webhook_events_type_idx').on(table.type),
    index('webhook_events_status_idx').on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// 7. Membership Stats
// ---------------------------------------------------------------------------

export const membershipStats = pgTable('membership_stats', {
  id: varchar('id', {length: 50}).primaryKey().default('memberships'),
  totalMembers: integer('total_members').notNull().default(0),
  activeMembers: integer('active_members').notNull().default(0),
  expiredMembers: integer('expired_members').notNull().default(0),
  canceledMembers: integer('canceled_members').notNull().default(0),
  individualCount: integer('individual_count').notNull().default(0),
  familyCount: integer('family_count').notNull().default(0),
  monthlyRevenue: numeric('monthly_revenue', {precision: 12, scale: 2}).notNull().default('0'),
  yearlyRevenue: numeric('yearly_revenue', {precision: 12, scale: 2}).notNull().default('0'),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 8. Audit Log
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {onDelete: 'set null'}),
    action: auditActionEnum('action').notNull(),
    performedBy: varchar('performed_by', {length: 128}).notNull(),
    performedByEmail: varchar('performed_by_email', {length: 255}),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('audit_log_user_id_idx').on(table.userId),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// 9. Email Log
// ---------------------------------------------------------------------------

export const emailLog = pgTable(
  'email_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    membershipId: uuid('membership_id').references(() => memberships.id, {onDelete: 'set null'}),
    emailType: varchar('email_type', {length: 80}).notNull(),
    deliveryType: varchar('delivery_type', {length: 20}).notNull(),
    campaignKey: varchar('campaign_key', {length: 255}).notNull(),
    recipientEmail: varchar('recipient_email', {length: 255}).notNull(),
    subject: varchar('subject', {length: 255}).notNull(),
    status: varchar('status', {length: 20}).notNull(),
    idempotencyKey: varchar('idempotency_key', {length: 255}).notNull(),
    sentBy: varchar('sent_by', {length: 128}).notNull(),
    sentByEmail: varchar('sent_by_email', {length: 255}),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('email_log_user_type_campaign_idx').on(table.userId, table.emailType, table.campaignKey),
    index('email_log_membership_idx').on(table.membershipId),
    index('email_log_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// 10. Meetup Events
// ---------------------------------------------------------------------------

export const meetupEvents = pgTable(
  'meetup_events',
  {
    guid: text('guid').primaryKey(),
    title: text('title').notNull(),
    url: text('url').notNull(),
    startDate: timestamp('start_date', {withTimezone: true}).notNull(),
    endDate: timestamp('end_date', {withTimezone: true}),
    location: text('location'),
    description: text('description'),
    lastSeenAt: timestamp('last_seen_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [index('meetup_events_start_date_idx').on(table.startDate)],
);

// ---------------------------------------------------------------------------
// 11. Trail Maintenance
// ---------------------------------------------------------------------------

export const trailSystems = pgTable(
  'trail_systems',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', {length: 80}).notNull().unique(),
    name: varchar('name', {length: 160}).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('trail_systems_slug_idx').on(table.slug),
    index('trail_systems_active_sort_idx').on(table.isActive, table.sortOrder),
  ],
);

export const trailSegments = pgTable(
  'trail_segments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    trailSystemId: uuid('trail_system_id')
      .notNull()
      .references(() => trailSystems.id, {onDelete: 'cascade'}),
    slug: varchar('slug', {length: 80}).notNull(),
    name: varchar('name', {length: 160}).notNull(),
    colorLabel: varchar('color_label', {length: 80}),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('trail_segments_system_slug_idx').on(table.trailSystemId, table.slug),
    index('trail_segments_system_active_sort_idx').on(
      table.trailSystemId,
      table.isActive,
      table.sortOrder,
    ),
  ],
);

export const trailMaintenanceReports = pgTable(
  'trail_maintenance_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicId: varchar('public_id', {length: 24}).notNull().unique(),
    trailSystemId: uuid('trail_system_id')
      .notNull()
      .references(() => trailSystems.id, {onDelete: 'restrict'}),
    trailSegmentId: uuid('trail_segment_id').references(() => trailSegments.id, {
      onDelete: 'set null',
    }),
    issueType: trailIssueTypeEnum('issue_type').notNull(),
    issueTypeOther: varchar('issue_type_other', {length: 160}),
    status: trailIssueStatusEnum('status').notNull().default('new'),
    priority: trailIssuePriorityEnum('priority').notNull().default('normal'),
    observedAt: timestamp('observed_at', {withTimezone: true}).notNull(),
    description: text('description'),
    locationSource: trailLocationSourceEnum('location_source').notNull().default('manual'),
    locationNotes: text('location_notes'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    locationAccuracyMeters: doublePrecision('location_accuracy_meters'),
    reporterName: varchar('reporter_name', {length: 160}),
    reporterContact: varchar('reporter_contact', {length: 255}),
    userAgent: text('user_agent'),
    submitterIpHash: varchar('submitter_ip_hash', {length: 128}),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    countyEmailGeneratedAt: timestamp('county_email_generated_at', {withTimezone: true}),
    countyEmailSentAt: timestamp('county_email_sent_at', {withTimezone: true}),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('trail_maintenance_reports_public_id_idx').on(table.publicId),
    index('trail_maintenance_reports_status_idx').on(table.status),
    index('trail_maintenance_reports_priority_idx').on(table.priority),
    index('trail_maintenance_reports_created_at_idx').on(table.createdAt),
    index('trail_maintenance_reports_system_status_idx').on(table.trailSystemId, table.status),
  ],
);

export const trailMaintenancePhotos = pgTable(
  'trail_maintenance_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => trailMaintenanceReports.id, {onDelete: 'cascade'}),
    bucketName: varchar('bucket_name', {length: 160}).notNull(),
    objectKey: text('object_key').notNull(),
    originalFilename: varchar('original_filename', {length: 255}),
    contentType: varchar('content_type', {length: 120}).notNull(),
    byteSize: integer('byte_size').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('trail_maintenance_photos_report_idx').on(table.reportId),
    uniqueIndex('trail_maintenance_photos_object_key_idx').on(table.objectKey),
  ],
);

export const trailMaintenanceNotes = pgTable(
  'trail_maintenance_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => trailMaintenanceReports.id, {onDelete: 'cascade'}),
    authorUserId: uuid('author_user_id').references(() => users.id, {onDelete: 'set null'}),
    authorEmail: varchar('author_email', {length: 255}),
    note: text('note').notNull(),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('trail_maintenance_notes_report_idx').on(table.reportId),
    index('trail_maintenance_notes_created_at_idx').on(table.createdAt),
  ],
);

export const trailMaintenanceEvents = pgTable(
  'trail_maintenance_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => trailMaintenanceReports.id, {onDelete: 'cascade'}),
    eventType: trailIssueEventTypeEnum('event_type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, {onDelete: 'set null'}),
    actorLabel: varchar('actor_label', {length: 255}).notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [
    index('trail_maintenance_events_report_idx').on(table.reportId),
    index('trail_maintenance_events_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// 12. Distributed API rate limits
// ---------------------------------------------------------------------------

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    scope: varchar('scope', {length: 80}).notNull(),
    identifierHash: varchar('identifier_hash', {length: 64}).notNull(),
    windowStart: timestamp('window_start', {withTimezone: true}).notNull(),
    requestCount: integer('request_count').notNull().default(1),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
  },
  (table) => [
    uniqueIndex('rate_limit_buckets_scope_identifier_idx').on(table.scope, table.identifierHash),
    index('rate_limit_buckets_expires_at_idx').on(table.expiresAt),
  ],
);

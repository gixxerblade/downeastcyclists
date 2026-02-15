import {
  boolean,
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

# Phase 01: Foundation and Schema Setup

This phase establishes the foundational infrastructure for migrating from Firestore to Neon Postgres. We'll install Drizzle ORM dependencies, create the database schema covering all 8 data domains, configure the database client, and generate the initial migration. This is purely additive - no existing code changes, ensuring the current app continues working while we build the new data layer alongside it.

## Tasks

- [x] Install Drizzle ORM and Neon dependencies:
  - Add `@netlify/neon`, `drizzle-orm`, `@neondatabase/serverless` to dependencies
  - Add `drizzle-kit` as dev dependency
  - Add database scripts to package.json: `db:generate`, `db:migrate`, `db:push`, `db:studio`

- [x] Create Drizzle configuration file:
  - Create `drizzle.config.ts` at project root
  - Configure schema path, migrations output directory, PostgreSQL dialect
  - Set database credentials to use `NETLIFY_DATABASE_URL` environment variable

- [x] Create database client module:
  - Create `src/db/client.ts` using `@netlify/neon` wrapper
  - Initialize Drizzle with neon HTTP client and schema
  - Export typed database instance and Database type

- [x] Create comprehensive Postgres schema covering all 8 data domains:
  - Create `src/db/schema.ts` with all table definitions
  - Define `users` table with firebase_uid mapping and Stripe integration
  - Define `memberships` table with subscription tracking and status management
  - Define `membership_cards` table with QR codes and PDF generation
  - Define `membership_plans` table for Stripe price configuration
  - Define `membership_counters` table for atomic membership number generation
  - Define `webhook_events` table for idempotency and processing status
  - Define `membership_stats` table for dashboard metrics
  - Define `audit_log` table for member activity tracking

- [x] Add database indexes and relations:
  - Create indexes on frequently queried columns (firebase_uid, email, stripe IDs)
  - Add composite indexes for common query patterns (status + end_date, user_id + status)
  - Define Drizzle relations between users, memberships, cards, and audit logs
  - Ensure optimal query performance for admin dashboard and member lookups

- [x] Generate and verify initial migration:
  - Run `pnpm db:generate` to create SQL migration from schema
  - Run `pnpm db:push` to apply schema to Neon database
  - Verify all tables created correctly in Neon console or via `pnpm db:studio`
  - Confirm indexes and constraints are properly applied

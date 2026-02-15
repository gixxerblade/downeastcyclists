# Phase 03: Integration and Migration

This phase swaps the application from Firestore to Postgres by updating layer configurations, service dependencies, and API routes. We'll create a data migration script to transfer existing Firestore data to Postgres, then perform cleanup by removing Firestore dependencies. After this phase, the application will be fully running on Postgres with all tests passing.

## Tasks

- [x] Update Effect-TS layer configuration:
  - Modify `src/lib/effect/layers.ts` to use `DatabaseServiceLive` instead of `FirestoreServiceLive`
  - Update `WebhookIdempotencyServiceLive` to use the Postgres-backed implementation
  - Maintain the same layer dependency graph structure
  - Ensure all dependent services receive the new database implementations

- [x] Update all dependent services to use DatabaseService:
  - Update `src/lib/effect/membership.service.ts` to depend on `DatabaseService`
  - Update `src/lib/effect/portal.service.ts` to use `DatabaseService` methods
  - Update `src/lib/effect/card.service.ts` for membership card operations
  - Update `src/lib/effect/stats.service.ts` for dashboard metrics
  - Update `src/lib/effect/export.service.ts` for data export functionality
  - Update `src/lib/effect/admin.service.ts` (largest consumer with ~15 method calls)

- [x] Update API routes and webhook handlers:
  - Update `app/api/webhooks/stripe/route.ts` to import and use `DatabaseService`
  - Update any other API routes that directly reference `FirestoreService`
  - Ensure webhook processing uses the new Postgres-backed idempotency service
  - Verify all route handlers maintain identical response shapes

- [x] Update reconciliation schemas and admin features:
  - Update `src/lib/effect/schemas.ts` to rename `FirebaseDataSnapshot` to `DatabaseDataSnapshot`
  - Update admin reconciliation service to compare Stripe data against Postgres
  - Ensure admin dashboard queries use the new efficient SQL-based methods
  - Verify search functionality uses SQL ILIKE instead of client-side filtering

- [x] Create comprehensive data migration script:
  - Create `scripts/migrate-firestore-to-neon.ts` for one-time data transfer
  - Implement Firebase Admin SDK reading of all 8 Firestore collections
  - Transform Firestore Timestamps to ISO strings for Postgres timestamptz
  - Maintain firebase_uid to postgres_uuid mapping for FK resolution
  - Use proper migration order respecting foreign key dependencies
  - Include batch processing, progress logging, and error handling
  - Make migration idempotent using ON CONFLICT for upserts

- [x] Execute migration and perform cleanup:
  - Run the migration script against production Firestore data
  - Verify row counts match between source and target databases
  - Validate all Stripe IDs and membership numbers are preserved exactly
  - Remove `src/lib/effect/firestore.service.ts` and `src/lib/firestore-client.ts`
  - Update `firestore.rules` to deny all reads/writes (lock down)
  - Remove `FirestoreError` from errors module after confirming no references
  - Delete `firestore.indexes.json` as it's no longer needed

- [ ] Run comprehensive validation suite:
  - Execute `pnpm tsc` to ensure zero TypeScript errors
  - Run `pnpm lint` and `pnpm format` for code quality
  - Execute `pnpm test:run` to verify all tests pass
  - Run `pnpm build` to confirm successful production build
  - Verify no remaining `FirestoreService` or `@google-cloud/firestore` imports
  - Test critical user flows: signup, membership purchase, admin dashboard, QR verification
  - Confirm webhook processing works end-to-end with Postgres backend

---

**Next Steps:** Click the Save button to save these plans and start execution. This will create a new session that runs all the phases in order. You can monitor the session progress from the Sessions page.

**Summary:** Created 3 phase documents for the Firestore to Neon Postgres migration:

1. **Phase 01**: Foundation setup with Drizzle ORM, schema creation, and database configuration
2. **Phase 02**: Core DatabaseService implementation with all 28 methods and WebhookIdempotencyService rewrite
3. **Phase 03**: Integration, data migration, and cleanup to complete the transition

Each phase builds on the previous one, with Phase 1 delivering a working database foundation, Phase 2 providing the complete service layer, and Phase 3 executing the full migration and cleanup.

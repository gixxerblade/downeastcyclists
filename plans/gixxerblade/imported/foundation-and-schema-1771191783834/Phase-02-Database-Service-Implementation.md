# Phase 02: Database Service Implementation

This phase builds the core `DatabaseService` that will replace `FirestoreService`, implementing all 28 methods with identical interfaces but backed by Drizzle ORM queries. We'll also rewrite the `WebhookIdempotencyService` for Postgres and add proper error handling. The new services will be ready for integration but won't be used yet - the existing Firestore services remain active.

## Tasks

- [x] Add DatabaseError to the errors module:
  - Update `src/lib/effect/errors.ts` to include `DatabaseError` tagged error class
  - Add code, message, and optional cause properties for detailed error reporting
  - Add `DatabaseError` to the `AppError` union type
  - Keep existing `FirestoreError` for now (removed in cleanup phase)

- [x] Create the core DatabaseService implementation:
  - Create `src/lib/effect/database.service.ts` with Effect-TS service pattern
  - Implement user management methods: `getUser`, `getUserByEmail`, `getUserByStripeCustomerId`
  - Implement user mutation methods: `createUser`, `updateUser`, `setUser`, `upsertUserByStripeCustomer`
  - Add helper function `resolveUserId(firebaseUid) → uuid` for FK resolution
  - Wrap all Drizzle queries with `Effect.tryPromise` and map errors to `DatabaseError`

- [x] Implement membership management methods:
  - Add `getMembership`, `getActiveMembership` with proper JOIN queries
  - Add `setMembership`, `updateMembership`, `deleteMembership` with FK handling
  - Implement `getAllMemberships` with single SQL query using JOINs (replaces N+1 pattern)
  - Add search, filtering, and pagination support with ILIKE and proper indexing
  - Implement `getExpiringMemberships` with single SQL query and date range filtering

- [x] Implement membership card and numbering methods:
  - Add `getMembershipCard`, `setMembershipCard`, `updateMembershipCard`
  - Add `getMembershipByNumber` with user JOIN for QR code verification
  - Implement atomic `getNextMembershipNumber` using ON CONFLICT DO UPDATE RETURNING
  - Ensure membership number generation is thread-safe and produces no duplicates

- [ ] Implement statistics and audit methods:
  - Add `getStats`, `updateStats` for dashboard metrics
  - Add `logAuditEntry`, `getMemberAuditLog` with proper user FK resolution
  - Implement `getAllUsers` for admin operations
  - Add `softDeleteMember` with transaction support for membership + card + audit updates

- [ ] Rewrite WebhookIdempotencyService for Postgres:
  - Update `src/lib/effect/webhook-idempotency.service.ts` to use Drizzle
  - Implement `claimEvent` with INSERT ON CONFLICT for atomic event claiming
  - Implement `completeEvent`, `failEvent` with proper status and timestamp updates
  - Add `cleanupOldEvents` with date-based deletion for maintenance
  - Replace all `FirestoreError` references with `DatabaseError`

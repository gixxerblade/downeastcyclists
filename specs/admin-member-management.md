# Plan: Admin Member Management Features

## Task Description

Implement comprehensive admin member management functionality including manual member creation, member editing, and member deletion with soft delete support. Additional features include bulk CSV import, membership extensions/pauses, enhanced search/filters, audit logging, expiring memberships report, and Stripe integration for payment history and refunds.

## Objective

Enable administrators to fully manage members through the admin dashboard, including creating legacy/complimentary memberships, editing member details and membership attributes, and safely deleting members while maintaining data integrity and audit trails.

## Problem Statement

The current admin system has limited member management capabilities:

- No way to add legacy members from the old system
- No ability to create complimentary memberships
- No member editing beyond what Stripe portal offers
- No soft delete functionality
- No bulk import for migrating existing members
- Limited audit trail for admin actions

Admins need full control over member data while maintaining Stripe synchronization and audit compliance.

## Solution Approach

Build a comprehensive member management system using:

1. **Effect-TS services** for type-safe operations with proper error handling
2. **TanStack Query mutations** for optimistic updates and proper loading states
3. **Soft delete pattern** with status='deleted' preserving all data
4. **Audit logging** for every admin action with before/after snapshots
5. **Stripe integration** for syncing email changes and canceling subscriptions

The implementation follows existing architectural patterns with AdminService extensions, new API routes, and React components using the established UI patterns.

## Relevant Files

### Existing Files to Modify

- `src/lib/effect/admin.service.ts` - Add CRUD operations for members
- `src/lib/effect/firestore.service.ts` - Add member query methods
- `src/lib/effect/stripe.service.ts` - Add cancel subscription, update customer, refund methods
- `src/lib/effect/auth.service.ts` - Add update user email method
- `src/lib/effect/errors.ts` - Add new error types (MemberNotFoundError, ValidationError)
- `src/lib/effect/client-admin.ts` - Add client-side Effect wrappers for new APIs
- `src/components/admin/MembershipManagement.tsx` - Add create/edit/delete buttons
- `src/components/admin/MemberTable.tsx` - Add delete button, enhance actions column
- `src/lib/effect/layers.ts` - Wire up new service dependencies

### New Files to Create

**API Routes:**

- `src/app/api/admin/members/route.ts` - POST: Create member
- `src/app/api/admin/members/[userId]/route.ts` - PUT: Update, DELETE: Soft delete
- `src/app/api/admin/members/import/route.ts` - POST: Bulk CSV import
- `src/app/api/admin/members/expiring/route.ts` - GET: Expiring memberships report
- `src/app/api/admin/members/[userId]/audit/route.ts` - GET: Member audit history
- `src/app/api/admin/members/[userId]/payment-history/route.ts` - GET: Stripe payment history
- `src/app/api/admin/members/[userId]/refund/route.ts` - POST: Issue refund

**Components:**

- `src/components/admin/CreateMemberModal.tsx` - Form for manual member creation
- `src/components/admin/EditMemberModal.tsx` - Form for editing member details
- `src/components/admin/DeleteMemberDialog.tsx` - Confirmation with reason input
- `src/components/admin/BulkImportModal.tsx` - CSV upload and preview
- `src/components/admin/MemberAuditLog.tsx` - Display audit history
- `src/components/admin/ExpiringMembersReport.tsx` - Expiring members view
- `src/components/admin/PaymentHistoryPanel.tsx` - Payment history display

**Types:**

- `src/types/admin.ts` - Admin-specific types (CreateMemberInput, UpdateMemberInput, etc.)

**Utilities:**

- `src/lib/csv-parser.ts` - CSV parsing and validation for bulk import

## Implementation Phases

### Phase 1: Foundation (Core CRUD)

1. Define TypeScript types for all admin operations
2. Extend AdminService with create/update/delete member methods
3. Add new error types to errors.ts
4. Create API routes for basic CRUD operations
5. Implement audit logging for all changes

### Phase 2: UI Components

1. Create CreateMemberModal with form validation
2. Create EditMemberModal with field-by-field editing
3. Create DeleteMemberDialog with soft delete flow
4. Integrate modals into MembershipManagement dashboard
5. Add action buttons to MemberTable

### Phase 3: Stripe Integration & Advanced Features

1. Sync email changes to Stripe and Firebase Auth
2. Cancel Stripe subscriptions before deletion
3. Implement payment history retrieval
4. Add refund functionality
5. Create bulk CSV import with preview/validation

### Phase 4: Reports & Polish

1. Expiring memberships report (30/60/90 days)
2. Enhanced audit log viewer
3. Search/filter improvements
4. Final testing and error handling

## Step by Step Tasks

### 1. Define Admin Types

- Create `src/types/admin.ts` with interfaces:

  ```typescript
  interface CreateMemberInput {
    email: string;
    name?: string;
    phone?: string;
    planType: 'individual' | 'family';
    startDate: string; // ISO date
    endDate: string; // ISO date
    status: 'active' | 'complimentary' | 'legacy';
    stripeCustomerId?: string; // Optional link
    notes?: string;
  }

  interface UpdateMemberInput {
    userId: string;
    email?: string;
    name?: string;
    phone?: string;
    planType?: 'individual' | 'family';
    startDate?: string;
    endDate?: string;
    status?: MembershipStatus | 'deleted';
    stripeCustomerId?: string;
    reason: string; // Required for audit
  }

  interface DeleteMemberInput {
    userId: string;
    reason: string;
    cancelStripeSubscription: boolean;
  }

  interface BulkImportRow {
    email: string;
    name?: string;
    phone?: string;
    planType: 'individual' | 'family';
    startDate: string;
    endDate: string;
  }

  interface AuditEntry {
    id: string;
    action: AuditAction;
    performedBy: string; // Admin UID
    performedByEmail: string;
    details: {
      previousValues?: Record<string, unknown>;
      newValues?: Record<string, unknown>;
      reason?: string;
    };
    timestamp: string;
  }

  type AuditAction =
    | 'MEMBER_CREATED'
    | 'MEMBER_UPDATED'
    | 'MEMBER_DELETED'
    | 'MEMBERSHIP_EXTENDED'
    | 'MEMBERSHIP_PAUSED'
    | 'EMAIL_CHANGED'
    | 'STRIPE_SYNCED'
    | 'REFUND_ISSUED'
    | 'BULK_IMPORT';
  ```

### 2. Add New Error Types

- Add to `src/lib/effect/errors.ts`:

  ```typescript
  export class MemberNotFoundError extends Data.TaggedError('MemberNotFoundError')<{
    readonly userId: string;
    readonly message: string;
  }> {}

  export class ValidationError extends Data.TaggedError('ValidationError')<{
    readonly field: string;
    readonly message: string;
  }> {}

  export class EmailConflictError extends Data.TaggedError('EmailConflictError')<{
    readonly email: string;
    readonly message: string;
  }> {}

  export class StripeSubscriptionActiveError extends Data.TaggedError(
    'StripeSubscriptionActiveError',
  )<{
    readonly subscriptionId: string;
    readonly message: string;
  }> {}
  ```

### 3. Extend Firestore Service

- Add methods to `src/lib/effect/firestore.service.ts`:
  - `createUser(userData)` - Create user document
  - `updateUser(userId, updates)` - Update user fields
  - `createMembership(userId, membershipData)` - Create membership subcollection doc
  - `updateMembership(userId, membershipId, updates)` - Update membership
  - `softDeleteMember(userId, deletedBy, reason)` - Set status='deleted'
  - `getUserByEmail(email)` - Check email uniqueness
  - `getExpiringMemberships(withinDays)` - Query expiring memberships
  - `getMemberAuditLog(userId)` - Get audit entries for user

### 4. Extend Stripe Service

- Add methods to `src/lib/effect/stripe.service.ts`:
  - `cancelSubscription(subscriptionId, reason)` - Cancel subscription immediately
  - `updateCustomerEmail(customerId, newEmail)` - Sync email to Stripe
  - `getPaymentHistory(customerId, limit)` - List invoices/payments
  - `createRefund(paymentIntentId, amount?, reason?)` - Issue refund
  - `createCustomer(email, name?, metadata?)` - Create Stripe customer

### 5. Extend Auth Service

- Add method to `src/lib/effect/auth.service.ts`:
  - `updateUserEmail(uid, newEmail)` - Update Firebase Auth email
  - `createUser(email, password?)` - Create Firebase Auth user (optional password for legacy)

### 6. Implement AdminService CRUD Methods

- Add to `src/lib/effect/admin.service.ts`:

  ```typescript
  // Create member manually (no Stripe flow)
  createMember: (input: CreateMemberInput, adminUid: string) =>
    Effect.Effect<{userId: string; membershipId: string}, ValidationError | EmailConflictError>;

  // Update member with full audit
  updateMember: (input: UpdateMemberInput, adminUid: string) =>
    Effect.Effect<void, MemberNotFoundError | ValidationError | StripeError>;

  // Soft delete with Stripe cancellation
  deleteMember: (input: DeleteMemberInput, adminUid: string) =>
    Effect.Effect<void, MemberNotFoundError | StripeSubscriptionActiveError>;

  // Bulk import from CSV
  bulkImportMembers: (rows: BulkImportRow[], adminUid: string) =>
    Effect.Effect<{created: number; errors: {row: number; error: string}[]}, ValidationError>;

  // Get expiring memberships
  getExpiringMemberships: (withinDays: 30 | 60 | 90) => Effect.Effect<Member[], FirestoreError>;

  // Get member audit history
  getMemberAuditLog: (userId: string) =>
    Effect.Effect<AuditEntry[], MemberNotFoundError | FirestoreError>;

  // Get payment history from Stripe
  getPaymentHistory: (userId: string) =>
    Effect.Effect<PaymentHistoryItem[], MemberNotFoundError | StripeError>;

  // Issue refund
  issueRefund: (
    userId: string,
    paymentIntentId: string,
    amount?: number, // Partial refund
    reason?: string,
    adminUid: string,
  ) => Effect.Effect<Stripe.Refund, StripeError>;
  ```

### 7. Create API Routes

- **POST `/api/admin/members`** - Create member
  - Validate input
  - Check email uniqueness
  - Create Firebase Auth user (no password for legacy)
  - Create user document
  - Create membership document
  - Create membership card
  - Log audit entry
  - Return userId and membershipId

- **PUT `/api/admin/members/[userId]`** - Update member
  - Validate input
  - Fetch current values for audit
  - Update user document
  - Update membership if changed
  - Sync email to Stripe/Firebase Auth if changed
  - Log audit entry with before/after

- **DELETE `/api/admin/members/[userId]`** - Soft delete
  - Require reason in body
  - Cancel Stripe subscription if active
  - Set membership.status = 'deleted'
  - Set card.status = 'deleted'
  - Log audit entry
  - Keep all data intact

- **POST `/api/admin/members/import`** - Bulk import
  - Accept CSV file
  - Parse and validate all rows
  - Return preview with validation errors
  - If `execute: true`, create all valid members
  - Log single audit entry with summary

- **GET `/api/admin/members/expiring`** - Expiring report
  - Accept `days` query param (30, 60, 90)
  - Return members expiring within timeframe
  - Include contact info for follow-up

- **GET `/api/admin/members/[userId]/audit`** - Audit history
  - Return all audit entries for user
  - Sort by timestamp descending

- **GET `/api/admin/members/[userId]/payment-history`** - Payment history
  - Fetch invoices from Stripe
  - Return formatted payment records

- **POST `/api/admin/members/[userId]/refund`** - Issue refund
  - Validate payment intent belongs to user
  - Create Stripe refund
  - Log audit entry

### 8. Create Client-Side Effect Wrappers

- Add to `src/lib/effect/client-admin.ts`:

  ```typescript
  export const createMember = (input: CreateMemberInput) =>
    Effect.tryPromise({
      try: () => fetch('/api/admin/members', {
        method: 'POST',
        body: JSON.stringify(input)
      }).then(handleResponse),
      catch: (error) => new AdminError({...})
    });

  export const updateMember = (userId: string, input: UpdateMemberInput) =>
    Effect.tryPromise({...});

  export const deleteMember = (userId: string, input: DeleteMemberInput) =>
    Effect.tryPromise({...});

  export const importMembers = (file: File, execute: boolean) =>
    Effect.tryPromise({...});

  export const getExpiringMemberships = (days: number) =>
    Effect.tryPromise({...});

  export const getMemberAuditLog = (userId: string) =>
    Effect.tryPromise({...});

  export const getPaymentHistory = (userId: string) =>
    Effect.tryPromise({...});

  export const issueRefund = (userId: string, paymentIntentId: string, amount?: number) =>
    Effect.tryPromise({...});
  ```

### 9. Create CreateMemberModal Component

- Form fields:
  - Email (required, validated)
  - Name (optional)
  - Phone (optional)
  - Plan Type (select: Individual/Family)
  - Start Date (date picker)
  - End Date (date picker)
  - Status (select: Active/Complimentary/Legacy)
  - Stripe Customer ID (optional, for linking later)
  - Notes (optional textarea)
- Validation:
  - Email format and uniqueness
  - End date after start date
  - Required fields present
- Use TanStack Query mutation with Effect.runPromise
- Show loading state, success toast, error handling
- Close modal and refresh member list on success

### 10. Create EditMemberModal Component

- Display current values
- Editable fields:
  - Email (with warning about Stripe/Auth sync)
  - Name
  - Phone
  - Plan Type
  - Start Date
  - End Date
  - Status (dropdown with all valid statuses)
  - Stripe Customer ID (with "Link" button to search)
- Required: Reason for change (textarea)
- Show diff preview before saving
- Use TanStack Query mutation
- Invalidate queries on success

### 11. Create DeleteMemberDialog Component

- Confirmation dialog with member info summary
- Required: Deletion reason (textarea)
- Checkbox: "Cancel Stripe subscription" (default checked if subscription active)
- Warning message about soft delete
- Two-step confirmation (type "DELETE" to confirm)
- Show what will happen:
  - Subscription will be canceled
  - Data will be retained
  - Member will lose access immediately
- Use TanStack Query mutation
- Redirect to member list on success

### 12. Create BulkImportModal Component

- File upload zone (drag-and-drop or click)
- CSV format instructions with example
- Preview table showing:
  - Parsed data
  - Validation status per row
  - Error messages
- Summary: X valid, Y invalid
- "Import Valid Rows" button (disabled if all invalid)
- Progress indicator during import
- Results summary with errors list

### 13. Create MemberAuditLog Component

- Timeline-style display of audit entries
- Each entry shows:
  - Action type (with icon/color)
  - Timestamp
  - Admin who performed action
  - Reason (if provided)
  - Changes made (expandable diff view)
- Pagination or infinite scroll
- Filter by action type

### 14. Create ExpiringMembersReport Component

- Tab bar: 30 days / 60 days / 90 days
- Table with:
  - Member info (name, email, phone)
  - Membership details (plan type, expiration date)
  - Days until expiration
  - Quick action buttons (extend, email)
- Export as CSV button
- Auto-refresh option

### 15. Create PaymentHistoryPanel Component

- Display within EditMemberModal or separate panel
- List of payments with:
  - Date
  - Amount
  - Status (paid, failed, refunded)
  - Invoice link
  - Refund button (if applicable)
- Pagination for long history

### 16. Integrate Components into Admin Dashboard

- Add "Create Member" button to MembershipManagement header
- Add action column to MemberTable with:
  - Edit button → Opens EditMemberModal
  - Delete button → Opens DeleteMemberDialog
  - Audit button → Opens MemberAuditLog
- Add "Bulk Import" button near Create Member
- Add "Expiring Memberships" tab or report link
- Wire up all modals with proper state management

### 17. Create CSV Parser Utility

- Add `src/lib/csv-parser.ts`:

  ```typescript
  export function parseCSV(content: string): BulkImportRow[];

  export function validateRow(row: BulkImportRow, index: number): ValidationResult;

  export function generateCSVTemplate(): string;
  ```

- Handle common issues:
  - Header row detection
  - Date format variations
  - Trimming whitespace
  - Handling special characters

### 18. Update Member Status Options

- Extend MembershipStatus type to include 'deleted' and 'complimentary':

  ```typescript
  type MembershipStatus =
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid'
    | 'trialing'
    | 'deleted' // Soft deleted
    | 'complimentary' // Free membership
    | 'legacy'; // Migrated from old system
  ```

- Update UI status chips with colors
- Update membership-access.ts with access rules for new statuses

### 19. Add Search and Filter Enhancements

- Enhance existing search to include:
  - Phone number search
  - Membership number search
  - Date range filter (created, expiring)
- Add "Include Deleted" toggle (off by default)
- Persist filters in URL params for sharing

### 20. Run Quality Checks and Fix Issues

- Execute `pnpm tsc` and fix type errors
- Execute `pnpm lint` and fix linting issues
- Execute `pnpm format` to format code
- Execute `pnpm test` and fix failing tests
- Execute `pnpm build` to verify production build

## Testing Strategy

### Unit Tests

1. **AdminService methods**
   - Test createMember with valid/invalid input
   - Test updateMember with various field combinations
   - Test deleteMember with active subscription
   - Test bulkImportMembers with mixed valid/invalid rows

2. **CSV Parser**
   - Test parseCSV with various formats
   - Test validateRow with edge cases
   - Test date format handling

3. **Audit logging**
   - Verify correct action types logged
   - Verify before/after snapshots accurate

### Integration Tests

1. **API Routes**
   - Test auth protection (403 for non-admins)
   - Test CRUD operations end-to-end
   - Test bulk import with real CSV

2. **Stripe Integration**
   - Test subscription cancellation
   - Test email sync
   - Test refund flow

### E2E Tests (if applicable)

1. **Create Member Flow**
   - Fill form, submit, verify member appears in list

2. **Edit Member Flow**
   - Open modal, change fields, verify changes saved

3. **Delete Member Flow**
   - Confirm deletion, verify soft delete applied

## Acceptance Criteria

- [ ] Admins can create members manually without Stripe checkout
- [ ] Admins can set membership type, dates, and status for manual members
- [ ] Admins can edit all member fields (email, name, phone, dates, status)
- [ ] Email changes sync to Stripe customer and Firebase Auth
- [ ] All admin changes are logged in audit trail with reason and before/after values
- [ ] Soft delete marks members as 'deleted' without removing data
- [ ] Stripe subscriptions are canceled before deletion (with option to skip)
- [ ] Deletion requires a reason
- [ ] Bulk CSV import works for legacy member migration
- [ ] Import preview shows validation errors before execution
- [ ] Expiring memberships report shows members expiring within 30/60/90 days
- [ ] Payment history shows Stripe invoices for members with stripeCustomerId
- [ ] Refunds can be issued through admin interface
- [ ] Deleted members hidden from main list by default
- [ ] Search works on email, name, phone, and membership number
- [ ] All operations use Effect-TS patterns with typed errors
- [ ] All components use TanStack Query for data fetching/mutations

## Validation Commands

Execute these commands to validate the task is complete:

- `pnpm tsc` - Verify no TypeScript errors
- `pnpm lint` - Verify no linting issues
- `pnpm format` - Ensure consistent formatting
- `pnpm test` - Run test suite and verify all tests pass
- `pnpm build` - Verify production build succeeds

## Notes

### Stripe Integration Considerations

- When updating email, must update both:
  1. Stripe customer (if stripeCustomerId exists)
  2. Firebase Auth user
- Canceling subscription uses `cancel_at_period_end: false` for immediate cancellation
- Refunds: Only full refunds initially; partial refund support can be added later
- New customers created for manual members only if admin provides email

### Security Considerations

- All admin routes must verify admin status via session cookie
- Audit log is append-only (no editing/deleting audit entries)
- Deletion reason is required and logged
- Two-step confirmation for deletions prevents accidents

### Data Integrity

- Soft delete preserves all data for compliance/audit
- Membership cards invalidated on deletion (status='deleted')
- Stats updated on creation/deletion

### Migration Path for Legacy Members

1. Admin exports legacy members to CSV
2. Admin uploads CSV to bulk import
3. System validates all rows
4. Admin reviews and confirms import
5. System creates all members with status='legacy'
6. Membership cards generated automatically

### Future Enhancements (Out of Scope)

- Role-based admin permissions (viewer, editor, super admin)
- Email templates for member communication
- Advanced analytics dashboard
- Automated expiration reminders
- Membership pause/resume with Stripe

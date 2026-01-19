/**
 * Admin-specific types for member management operations
 */

import type {MembershipStatus, PlanType} from '@/src/lib/effect/schemas';

// Extended membership status to include admin-specific statuses
export type ExtendedMembershipStatus =
  | MembershipStatus
  | 'deleted' // Soft deleted
  | 'complimentary' // Free membership
  | 'legacy'; // Migrated from old system

// Input for creating a member manually
export interface CreateMemberInput {
  email: string;
  name?: string;
  phone?: string;
  planType: PlanType;
  startDate: string; // ISO date
  endDate: string; // ISO date
  status: 'active' | 'complimentary' | 'legacy';
  stripeCustomerId?: string; // Optional link
  notes?: string;
}

// Input for updating a member
export interface UpdateMemberInput {
  email?: string;
  name?: string;
  phone?: string;
  planType?: PlanType;
  startDate?: string;
  endDate?: string;
  status?: ExtendedMembershipStatus;
  stripeCustomerId?: string;
  reason: string; // Required for audit
}

// Input for deleting a member
export interface DeleteMemberInput {
  reason: string;
  cancelStripeSubscription: boolean;
}

// Row from CSV bulk import
export interface BulkImportRow {
  email: string;
  name?: string;
  phone?: string;
  planType: 'individual' | 'family';
  startDate: string;
  endDate: string;
}

// Validation result for a single import row
export interface ImportRowValidation {
  row: number;
  valid: boolean;
  errors: string[];
  data?: BulkImportRow;
}

// Bulk import preview result
export interface BulkImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRowValidation[];
}

// Bulk import execution result
export interface BulkImportResult {
  created: number;
  errors: Array<{row: number; email?: string; error: string}>;
}

// Audit action types
export type AuditAction =
  | 'MEMBER_CREATED'
  | 'MEMBER_UPDATED'
  | 'MEMBER_DELETED'
  | 'MEMBERSHIP_EXTENDED'
  | 'MEMBERSHIP_PAUSED'
  | 'EMAIL_CHANGED'
  | 'STRIPE_SYNCED'
  | 'REFUND_ISSUED'
  | 'BULK_IMPORT'
  | 'ADMIN_ROLE_CHANGE'
  | 'MEMBERSHIP_ADJUSTMENT'
  | 'RECONCILIATION';

// Audit entry from Firestore
export interface AuditEntry {
  id: string;
  action: AuditAction;
  performedBy: string; // Admin UID
  performedByEmail?: string;
  details: {
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    reason?: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

// Payment history item from Stripe
export interface PaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'failed' | 'refunded' | 'pending';
  description: string;
  invoiceUrl?: string;
  paymentIntentId?: string;
  refundable: boolean;
}

// Refund request
export interface RefundRequest {
  paymentIntentId: string;
  amount?: number; // Partial refund amount in cents, undefined for full refund
  reason?: string;
}

// Expiring member with additional info
export interface ExpiringMember {
  userId: string;
  email: string;
  name?: string;
  phone?: string;
  planType: PlanType;
  status: MembershipStatus;
  membershipNumber?: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

// Member search params extended with additional filters
export interface ExtendedMemberSearchParams {
  query?: string;
  status?: MembershipStatus;
  planType?: PlanType;
  expiringWithinDays?: number;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

// API response types
export interface CreateMemberResponse {
  userId: string;
  membershipId: string;
  membershipNumber: string;
}

export interface UpdateMemberResponse {
  success: boolean;
  emailSyncedToStripe?: boolean;
  emailSyncedToAuth?: boolean;
}

export interface DeleteMemberResponse {
  success: boolean;
  stripeSubscriptionCanceled?: boolean;
}

export interface GetAuditLogResponse {
  entries: AuditEntry[];
  total: number;
}

export interface GetPaymentHistoryResponse {
  payments: PaymentHistoryItem[];
  hasMore: boolean;
}

export interface RefundResponse {
  refundId: string;
  status: string;
  amount: number;
}

export interface GetExpiringMembersResponse {
  members: ExpiringMember[];
  total: number;
}

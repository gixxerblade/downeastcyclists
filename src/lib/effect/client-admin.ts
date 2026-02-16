/**
 * Client-side Effect utilities for admin operations
 * Following the Effect-TS + TanStack Query architecture pattern
 */

import {Effect} from 'effect';

import type {
  AuditEntry,
  BulkImportResult,
  BulkImportRow,
  CreateMemberInput,
  CreateMemberResponse,
  DeleteMemberInput,
  DeleteMemberResponse,
  ExpiringMember,
  PaymentHistoryItem,
  RefundRequest,
  RefundResponse,
  UpdateMemberInput,
  UpdateMemberResponse,
} from '@/src/types/admin';

import {AdminError, DatabaseError, StripeError, UnauthorizedError, ValidationError} from './errors';
import type {MembershipStats, MemberWithMembership} from './schemas';

export interface GetMembersParams {
  page: number;
  pageSize: number;
  query?: string;
  status?: string;
  planType?: string;
}

export interface GetMembersResponse {
  members: MemberWithMembership[];
  total: number;
}

/**
 * Refresh membership stats by recalculating from all memberships
 * Uses Effect.tryPromise to wrap the API call with typed errors
 */
export const refreshStats = (): Effect.Effect<MembershipStats, DatabaseError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/admin/stats', {method: 'POST'});

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({
          message: data.error || 'Unauthorized',
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh stats');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new DatabaseError({
        code: 'REFRESH_STATS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to refresh stats',
        cause: error,
      });
    },
  });

/**
 * Get current cached membership stats
 */
export const getStats = (): Effect.Effect<MembershipStats, DatabaseError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/admin/stats');

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({
          message: data.error || 'Unauthorized',
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get stats');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new DatabaseError({
        code: 'GET_STATS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get stats',
        cause: error,
      });
    },
  });

/**
 * Get paginated list of members with optional filters
 */
export const getMembers = (
  params: GetMembersParams,
): Effect.Effect<GetMembersResponse, DatabaseError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const searchParams = new URLSearchParams({
        page: params.page.toString(),
        pageSize: params.pageSize.toString(),
      });

      if (params.query) searchParams.set('query', params.query);
      if (params.status) searchParams.set('status', params.status);
      if (params.planType) searchParams.set('planType', params.planType);

      const response = await fetch(`/api/admin/members?${searchParams}`);

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({
          message: data.error || 'Unauthorized',
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get members');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new DatabaseError({
        code: 'GET_MEMBERS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get members',
        cause: error,
      });
    },
  });

/**
 * Create a new member manually
 */
export const createMember = (
  input: CreateMemberInput,
): Effect.Effect<CreateMemberResponse, AdminError | ValidationError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (response.status === 400) {
        const data = await response.json();
        throw new ValidationError({field: 'input', message: data.error || 'Validation failed'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create member');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        return error;
      }
      return new AdminError({
        code: 'CREATE_MEMBER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create member',
        cause: error,
      });
    },
  });

/**
 * Update an existing member
 */
export const updateMember = (
  userId: string,
  input: UpdateMemberInput,
): Effect.Effect<UpdateMemberResponse, AdminError | ValidationError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/admin/members/${userId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (response.status === 400) {
        const data = await response.json();
        throw new ValidationError({field: 'input', message: data.error || 'Validation failed'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update member');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        return error;
      }
      return new AdminError({
        code: 'UPDATE_MEMBER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update member',
        cause: error,
      });
    },
  });

/**
 * Soft delete a member
 */
export const deleteMember = (
  userId: string,
  input: DeleteMemberInput,
): Effect.Effect<DeleteMemberResponse, AdminError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/admin/members/${userId}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete member');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new AdminError({
        code: 'DELETE_MEMBER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete member',
        cause: error,
      });
    },
  });

/**
 * Bulk import members from CSV data
 */
export const importMembers = (
  rows: BulkImportRow[],
): Effect.Effect<BulkImportResult, AdminError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/admin/members/import', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rows}),
      });

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import members');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new AdminError({
        code: 'IMPORT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to import members',
        cause: error,
      });
    },
  });

/**
 * Get expiring memberships report
 */
export const getExpiringMemberships = (
  days: 30 | 60 | 90,
): Effect.Effect<ExpiringMember[], DatabaseError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/admin/members/expiring?days=${days}`);

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get expiring memberships');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new DatabaseError({
        code: 'GET_EXPIRING_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get expiring memberships',
        cause: error,
      });
    },
  });

/**
 * Get member audit log
 */
export const getMemberAuditLog = (
  userId: string,
): Effect.Effect<AuditEntry[], DatabaseError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/admin/members/${userId}/audit`);

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get audit log');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new DatabaseError({
        code: 'GET_AUDIT_LOG_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get audit log',
        cause: error,
      });
    },
  });

/**
 * Get member payment history
 */
export const getPaymentHistory = (
  userId: string,
): Effect.Effect<PaymentHistoryItem[], StripeError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/admin/members/${userId}/payment-history`);

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get payment history');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new StripeError({
        code: 'GET_PAYMENT_HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get payment history',
        cause: error,
      });
    },
  });

/**
 * Issue a refund for a payment
 */
export const issueRefund = (
  userId: string,
  request: RefundRequest,
): Effect.Effect<RefundResponse, StripeError | UnauthorizedError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/admin/members/${userId}/refund`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(request),
      });

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        throw new UnauthorizedError({message: data.error || 'Unauthorized'});
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to issue refund');
      }

      return await response.json();
    },
    catch: (error) => {
      if (error instanceof UnauthorizedError) {
        return error;
      }
      return new StripeError({
        code: 'REFUND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to issue refund',
        cause: error,
      });
    },
  });

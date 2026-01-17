/**
 * Client-side Effect utilities for admin operations
 * Following the Effect-TS + TanStack Query architecture pattern
 */

import {Effect} from 'effect';

import {FirestoreError, UnauthorizedError} from './errors';
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
export const refreshStats = (): Effect.Effect<
  MembershipStats,
  FirestoreError | UnauthorizedError
> =>
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
      return new FirestoreError({
        code: 'REFRESH_STATS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to refresh stats',
        cause: error,
      });
    },
  });

/**
 * Get current cached membership stats
 */
export const getStats = (): Effect.Effect<MembershipStats, FirestoreError | UnauthorizedError> =>
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
      return new FirestoreError({
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
): Effect.Effect<GetMembersResponse, FirestoreError | UnauthorizedError> =>
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
      return new FirestoreError({
        code: 'GET_MEMBERS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get members',
        cause: error,
      });
    },
  });

import {Effect} from 'effect';

import {StripeError, NotFoundError} from './errors';

/**
 * Client-side portal operations using Effect-TS
 * These wrap client-side API calls with Effect for consistent error handling
 */

interface PortalSessionResponse {
  url: string;
}

// Create Stripe Customer Portal session
export const createPortalSession = (
  returnUrl: string,
): Effect.Effect<PortalSessionResponse, StripeError | NotFoundError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({returnUrl}),
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 404) {
          throw new NotFoundError({
            resource: 'stripeCustomer',
            id: 'current_user',
          });
        }

        throw new StripeError({
          code: 'PORTAL_CREATE_FAILED',
          message: data.error || 'Failed to create portal session',
        });
      }

      return response.json();
    },
    catch: (error) => {
      // If it's already a tagged error, re-throw it
      if (
        error &&
        typeof error === 'object' &&
        '_tag' in error &&
        (error._tag === 'NotFoundError' || error._tag === 'StripeError')
      ) {
        return error as StripeError | NotFoundError;
      }

      // Otherwise wrap in StripeError
      return new StripeError({
        code: 'PORTAL_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to request portal session',
        cause: error,
      });
    },
  });

// Get membership dashboard data
export const getMembershipDashboard = (): Effect.Effect<unknown, StripeError | NotFoundError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/member/dashboard');

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 404) {
          throw new NotFoundError({
            resource: 'membership',
            id: 'current_user',
          });
        }

        throw new StripeError({
          code: 'DASHBOARD_FETCH_FAILED',
          message: data.error || 'Failed to fetch dashboard',
        });
      }

      return response.json();
    },
    catch: (error) => {
      if (
        error &&
        typeof error === 'object' &&
        '_tag' in error &&
        (error._tag === 'NotFoundError' || error._tag === 'StripeError')
      ) {
        return error as StripeError | NotFoundError;
      }

      return new StripeError({
        code: 'DASHBOARD_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to request dashboard',
        cause: error,
      });
    },
  });

import {Effect} from 'effect';

import {CardError, NotFoundError, SessionError} from './errors';
import type {MembershipCard} from './schemas';

/**
 * Client-side card operations using Effect-TS
 * Wraps client-side API calls with Effect for consistent error handling
 */

interface CardResponse {
  hasCard: boolean;
  card: MembershipCard | null;
}

// Fetch digital membership card
export const getDigitalCard = (): Effect.Effect<
  CardResponse,
  CardError | NotFoundError | SessionError
> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/membership/card');

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 401) {
          throw new SessionError({
            code: 'SESSION_EXPIRED',
            message: data.error || 'Session expired',
          });
        }

        if (response.status === 404) {
          throw new NotFoundError({
            resource: 'membershipCard',
            id: 'current_user',
          });
        }

        throw new CardError({
          code: 'CARD_FETCH_FAILED',
          message: data.error || 'Failed to fetch membership card',
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
        (error._tag === 'NotFoundError' ||
          error._tag === 'CardError' ||
          error._tag === 'SessionError')
      ) {
        return error as CardError | NotFoundError | SessionError;
      }

      // Otherwise wrap in CardError
      return new CardError({
        code: 'CARD_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to request card',
        cause: error,
      });
    },
  });

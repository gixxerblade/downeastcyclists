import {Effect} from 'effect';

import {auth} from '@/src/utils/firebase';

import {createAccount} from './client-signup';
import {AuthError} from './errors';

export interface JoinRequest {
  email: string;
  password: string;
  name?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  coverFees: boolean;
  planPrice: number;
}

export interface JoinResult {
  checkoutUrl: string;
}

// Create Firestore user document via API
const createFirestoreUser = (
  idToken: string,
  name?: string,
): Effect.Effect<{success: boolean; userId: string}, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({idToken, name}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user in Firestore');
      }

      return response.json();
    },
    catch: (error) =>
      new AuthError({
        code: 'FIRESTORE_USER_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create user in Firestore',
        cause: error,
      }),
  });

// Create checkout session via API
const createCheckoutSession = (params: {
  priceId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  coverFees: boolean;
  planPrice: number;
}): Effect.Effect<{sessionId: string; url: string}, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          priceId: params.priceId,
          userId: params.userId,
          email: params.email,
          successUrl: params.successUrl,
          cancelUrl: params.cancelUrl,
          coverFees: params.coverFees,
          planPrice: params.planPrice,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      return response.json();
    },
    catch: (error) =>
      new AuthError({
        code: 'CHECKOUT_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create checkout session',
        cause: error,
      }),
  });

// Complete join flow: create account + Firestore doc + checkout session
export const joinAndCheckout = (request: JoinRequest): Effect.Effect<JoinResult, AuthError> =>
  Effect.gen(function* () {
    // Step 1: Create Firebase Auth account
    const user = yield* createAccount({
      email: request.email,
      password: request.password,
      name: request.name,
    });

    // Step 2: Get ID token for Firestore user creation
    const idToken = yield* Effect.tryPromise({
      try: async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('User not authenticated after signup');
        }
        return currentUser.getIdToken();
      },
      catch: (error) =>
        new AuthError({
          code: 'TOKEN_GET_FAILED',
          message: 'Failed to get authentication token',
          cause: error,
        }),
    });

    // Step 3: Create Firestore user document
    yield* createFirestoreUser(idToken, request.name);

    // Step 4: Create Stripe checkout session
    const checkout = yield* createCheckoutSession({
      priceId: request.priceId,
      userId: user.uid,
      email: user.email,
      successUrl: request.successUrl,
      cancelUrl: request.cancelUrl,
      coverFees: request.coverFees,
      planPrice: request.planPrice,
    });

    return {checkoutUrl: checkout.url};
  });

import {Effect} from 'effect';

import type {WaiverSignatureInput} from '@/src/lib/waivers/schemas';
import {auth} from '@/src/utils/firebase';

import {createSessionCookie} from './client-auth';
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
  waiver: {
    templateId: string;
    signature: WaiverSignatureInput;
  };
}

export interface JoinResult {
  checkoutUrl: string;
}

// Create user document via API
const createDatabaseUser = (
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
        throw new Error(data.error || 'Failed to create user');
      }

      return response.json();
    },
    catch: (error) =>
      new AuthError({
        code: 'USER_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create user',
        cause: error,
      }),
  });

// Create checkout session via API
const createCheckoutSession = (params: {
  priceId: string;
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

const signRequiredWaiver = (waiver: JoinRequest['waiver']): Effect.Effect<void, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/api/member/waivers/${waiver.templateId}/sign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(waiver.signature),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        const message =
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : 'Failed to sign the required waiver';
        throw new Error(message);
      }
    },
    catch: (cause) =>
      new AuthError({
        code: 'WAIVER_SIGNATURE_FAILED',
        message: cause instanceof Error ? cause.message : 'Failed to sign the required waiver',
        cause,
      }),
  });

// Complete join flow: create account + database user + checkout session
export const joinAndCheckout = (request: JoinRequest): Effect.Effect<JoinResult, AuthError> =>
  Effect.gen(function* () {
    // Step 1: Create Firebase Auth account
    const user = yield* createAccount({
      email: request.email,
      password: request.password,
      name: request.name,
    });

    // Step 2: Get ID token for user creation
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

    // Step 3: Create user document
    yield* createDatabaseUser(idToken, request.name);

    // Step 4: Establish the server-side session before checkout. The checkout
    // endpoint derives the new member identity from this verified cookie.
    yield* createSessionCookie(idToken);

    // Step 5: Store the required waiver before taking payment. If interrupted
    // after account creation, the member can sign in and finish in the portal.
    yield* signRequiredWaiver(request.waiver);

    // Step 6: Create Stripe checkout session
    const checkout = yield* createCheckoutSession({
      priceId: request.priceId,
      email: user.email,
      successUrl: request.successUrl,
      cancelUrl: request.cancelUrl,
      coverFees: request.coverFees,
      planPrice: request.planPrice,
    });

    return {checkoutUrl: checkout.url};
  });

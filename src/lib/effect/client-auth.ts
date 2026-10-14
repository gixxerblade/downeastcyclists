import {Effect} from 'effect';
import {
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  type UserCredential,
} from 'firebase/auth';

import type {AccessRole} from '@/src/lib/access-control';
import {safeLoginReturnPath, waiverSigningPath} from '@/src/lib/waivers/navigation';
import {auth} from '@/src/utils/firebase';

import {AuthError} from './errors';

/**
 * Client-side auth operations using Effect-TS
 * These wrap Firebase Client SDK (not Admin SDK)
 */

interface SessionResponse {
  success: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

// All cookie mutations share one queue so a slow previous-account response
// cannot overwrite the new account's session or recreate a logged-out session.
let sessionUpdates: Promise<void> = Promise.resolve();
function updateSession<A>(operation: () => Promise<A>): Promise<A> {
  const result = sessionUpdates.then(operation);
  sessionUpdates = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export const clearSessionCookie = (): Effect.Effect<void, AuthError> =>
  Effect.tryPromise({
    try: () =>
      updateSession(async () => {
        const response = await fetch('/api/auth/session', {method: 'DELETE'});
        if (!response.ok) throw new Error('Unable to clear your session');
      }),
    catch: (cause) =>
      new AuthError({code: 'SESSION_CLEAR_FAILED', message: 'Unable to clear your session', cause}),
  });

export const getCurrentAccessRole = (): Effect.Effect<AccessRole, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/admin/check');
      if (!response.ok) return 'member';
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'role' in data &&
        (data.role === 'admin' || data.role === 'organizer' || data.role === 'member')
      ) {
        return data.role;
      }
      return 'member';
    },
    catch: (error) =>
      new AuthError({
        code: 'ACCESS_CHECK_FAILED',
        message: 'Failed to determine account access',
        cause: error,
      }),
  });

export const getPostLoginRedirectPath = (returnTo?: string): Effect.Effect<string, AuthError> =>
  Effect.gen(function* () {
    const requested = safeLoginReturnPath(returnTo);
    if (requested?.startsWith('/waivers')) return requested;
    const role = yield* getCurrentAccessRole();
    return yield* Effect.tryPromise({
      try: async () => {
        const waiverResponse = await fetch('/api/member/waivers', {cache: 'no-store'});
        const waiverStatus: unknown = waiverResponse.ok ? await waiverResponse.json() : null;
        const needsMembership =
          typeof waiverStatus === 'object' &&
          waiverStatus !== null &&
          'needsMembership' in waiverStatus &&
          waiverStatus.needsMembership === true;
        const destination =
          requested ?? (role !== 'member' ? '/dashboard' : needsMembership ? '/renew' : '/member');
        if (!waiverResponse.ok) return waiverSigningPath({returnTo: destination});
        if (
          typeof waiverStatus !== 'object' ||
          waiverStatus === null ||
          !('hasPendingRequired' in waiverStatus) ||
          waiverStatus.hasPendingRequired !== false
        ) {
          return waiverSigningPath({returnTo: destination});
        }
        return destination;
      },
      catch: (error) =>
        new AuthError({
          code: 'POST_LOGIN_REDIRECT_FAILED',
          message: 'Failed to determine where to send you after login',
          cause: error,
        }),
    });
  });

// Sign in with email/password
export const signInWithPassword = (
  credentials: LoginCredentials,
): Effect.Effect<UserCredential, AuthError> =>
  Effect.tryPromise({
    try: () => signInWithEmailAndPassword(auth, credentials.email, credentials.password),
    catch: (error) =>
      new AuthError({
        code: 'SIGN_IN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to sign in',
        cause: error,
      }),
  });

// Create session cookie via API
export const createSessionCookie = (idToken: string): Effect.Effect<SessionResponse, AuthError> =>
  Effect.tryPromise({
    try: () =>
      updateSession(async () => {
        // Idempotently repair signup interruptions between Firebase account creation
        // and the database profile, including password and magic-link recovery.
        const profile = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({idToken}),
        });
        if (!profile.ok)
          throw new Error('Unable to prepare your member account. Please sign in again to retry.');
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({idToken}),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create session');
        }

        return response.json();
      }),
    catch: (error) =>
      new AuthError({
        code: 'SESSION_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create session',
        cause: error,
      }),
  });

// Send magic link
export const sendMagicLink = (email: string, returnUrl: string): Effect.Effect<void, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const actionCodeSettings = {
        url: returnUrl,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
    },
    catch: (error) =>
      new AuthError({
        code: 'MAGIC_LINK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send magic link',
        cause: error,
      }),
  });

// Complete login flow: sign in + create session
export const loginWithPassword = (
  credentials: LoginCredentials,
): Effect.Effect<SessionResponse, AuthError> =>
  Effect.gen(function* () {
    // Sign in with Firebase
    const userCredential = yield* signInWithPassword(credentials);

    // Get ID token
    const idToken = yield* Effect.tryPromise({
      try: () => userCredential.user.getIdToken(),
      catch: (error) =>
        new AuthError({
          code: 'TOKEN_GET_FAILED',
          message: 'Failed to get ID token',
          cause: error,
        }),
    });

    // Create session
    return yield* createSessionCookie(idToken);
  });

// Verify a password reset code and return the associated email
export const verifyPasswordResetCode = (oobCode: string): Effect.Effect<string, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const {verifyPasswordResetCode: verify} = await import('firebase/auth');
      return verify(auth, oobCode);
    },
    catch: (error) =>
      new AuthError({
        code: 'VERIFY_RESET_CODE_FAILED',
        message: error instanceof Error ? error.message : 'Invalid or expired reset link',
        cause: error,
      }),
  });

// Complete a password reset using the oob code
export const confirmPasswordReset = (
  oobCode: string,
  newPassword: string,
): Effect.Effect<void, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const {confirmPasswordReset: confirm} = await import('firebase/auth');
      await confirm(auth, oobCode, newPassword);
    },
    catch: (error) =>
      new AuthError({
        code: 'CONFIRM_RESET_FAILED',
        message: error instanceof Error ? error.message : 'Failed to reset password',
        cause: error,
      }),
  });

// Verify if current URL is a sign-in link
export const isValidSignInLink = (url: string): Effect.Effect<boolean, never> =>
  Effect.sync(() => {
    // Dynamic import to handle client-side only
    const {isSignInWithEmailLink} = require('firebase/auth');
    return isSignInWithEmailLink(auth, url);
  });

// Complete magic link sign-in
export const completeMagicLinkSignIn = (
  email: string,
  emailLink: string,
): Effect.Effect<SessionResponse, AuthError> =>
  Effect.gen(function* () {
    // Sign in with email link
    const userCredential = yield* Effect.tryPromise({
      try: async () => {
        const {signInWithEmailLink} = await import('firebase/auth');
        return signInWithEmailLink(auth, email, emailLink);
      },
      catch: (error) =>
        new AuthError({
          code: 'MAGIC_LINK_SIGN_IN_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sign in with magic link',
          cause: error,
        }),
    });

    // Clear stored email
    yield* Effect.sync(() => {
      window.localStorage.removeItem('emailForSignIn');
    });

    // Get ID token
    const idToken = yield* Effect.tryPromise({
      try: () => userCredential.user.getIdToken(),
      catch: (error) =>
        new AuthError({
          code: 'TOKEN_GET_FAILED',
          message: 'Failed to get ID token',
          cause: error,
        }),
    });

    // Create session
    return yield* createSessionCookie(idToken);
  });

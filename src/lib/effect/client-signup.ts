import {Effect} from 'effect';
import {createUserWithEmailAndPassword} from 'firebase/auth';

import {auth} from '@/src/utils/firebase';

import {createSessionCookie} from './client-auth';
import {AuthError} from './errors';

interface SignupCredentials {
  email: string;
  password: string;
  name?: string;
}

// Create new user account
export const createAccount = (
  credentials: SignupCredentials,
): Effect.Effect<{uid: string; email: string}, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password,
      );

      // Optionally update display name
      if (credentials.name) {
        const {updateProfile} = await import('firebase/auth');
        await updateProfile(userCredential.user, {
          displayName: credentials.name,
        });
      }

      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email || credentials.email,
      };
    },
    catch: (error) => {
      // Parse Firebase error codes
      let message = 'Failed to create account';
      let code = 'SIGNUP_FAILED';

      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseCode = error.code as string;

        switch (firebaseCode) {
          case 'auth/email-already-in-use':
            message = 'This email is already registered';
            code = 'EMAIL_IN_USE';
            break;
          case 'auth/invalid-email':
            message = 'Invalid email address';
            code = 'INVALID_EMAIL';
            break;
          case 'auth/weak-password':
            message = 'Password should be at least 6 characters';
            code = 'WEAK_PASSWORD';
            break;
          default:
            message = error instanceof Error ? error.message : message;
        }
      }

      return new AuthError({code, message, cause: error});
    },
  });

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

// Complete signup flow: create account + database user + session
export const signupAndLogin = (
  credentials: SignupCredentials,
): Effect.Effect<{success: boolean}, AuthError> =>
  Effect.gen(function* () {
    // Create the account
    yield* createAccount(credentials);

    // Get ID token
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

    // Create user document
    yield* createDatabaseUser(idToken, credentials.name);

    // Create session
    yield* createSessionCookie(idToken);

    return {success: true};
  });

import { Effect } from "effect";
import {
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  type UserCredential,
  type Auth,
} from "firebase/auth";
import { auth } from "@/src/utils/firebase";
import { AuthError } from "./errors";

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

// Sign in with email/password
export const signInWithPassword = (
  credentials: LoginCredentials,
): Effect.Effect<UserCredential, AuthError> =>
  Effect.tryPromise({
    try: () => signInWithEmailAndPassword(auth, credentials.email, credentials.password),
    catch: (error) =>
      new AuthError({
        code: "SIGN_IN_FAILED",
        message: error instanceof Error ? error.message : "Failed to sign in",
        cause: error,
      }),
  });

// Create session cookie via API
export const createSessionCookie = (idToken: string): Effect.Effect<SessionResponse, AuthError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create session");
      }

      return response.json();
    },
    catch: (error) =>
      new AuthError({
        code: "SESSION_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Failed to create session",
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
      window.localStorage.setItem("emailForSignIn", email);
    },
    catch: (error) =>
      new AuthError({
        code: "MAGIC_LINK_FAILED",
        message: error instanceof Error ? error.message : "Failed to send magic link",
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
          code: "TOKEN_GET_FAILED",
          message: "Failed to get ID token",
          cause: error,
        }),
    });

    // Create session
    return yield* createSessionCookie(idToken);
  });

// Verify if current URL is a sign-in link
export const isValidSignInLink = (url: string): Effect.Effect<boolean, never> =>
  Effect.sync(() => {
    // Dynamic import to handle client-side only
    const { isSignInWithEmailLink } = require("firebase/auth");
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
        const { signInWithEmailLink } = await import("firebase/auth");
        return signInWithEmailLink(auth, email, emailLink);
      },
      catch: (error) =>
        new AuthError({
          code: "MAGIC_LINK_SIGN_IN_FAILED",
          message: error instanceof Error ? error.message : "Failed to sign in with magic link",
          cause: error,
        }),
    });

    // Clear stored email
    yield* Effect.sync(() => {
      window.localStorage.removeItem("emailForSignIn");
    });

    // Get ID token
    const idToken = yield* Effect.tryPromise({
      try: () => userCredential.user.getIdToken(),
      catch: (error) =>
        new AuthError({
          code: "TOKEN_GET_FAILED",
          message: "Failed to get ID token",
          cause: error,
        }),
    });

    // Create session
    return yield* createSessionCookie(idToken);
  });

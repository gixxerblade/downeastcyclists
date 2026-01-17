import { Context, Effect, Layer } from "effect";
import type { DecodedIdToken } from "firebase-admin/auth";
import { initializeFirebaseAdmin } from "../firebase-admin";
import { AuthError, SessionError } from "./errors";

// Service interface
export interface AuthService {
  readonly verifyIdToken: (idToken: string) => Effect.Effect<DecodedIdToken, AuthError>;

  readonly createSessionCookie: (
    idToken: string,
    expiresIn: number,
  ) => Effect.Effect<string, AuthError>;

  readonly verifySessionCookie: (
    sessionCookie: string,
  ) => Effect.Effect<DecodedIdToken, SessionError>;

  readonly revokeRefreshTokens: (uid: string) => Effect.Effect<void, AuthError>;

  readonly getUser: (
    uid: string,
  ) => Effect.Effect<
    { uid: string; email: string | undefined; displayName: string | undefined },
    AuthError
  >;

  readonly setCustomClaims: (
    uid: string,
    claims: { admin?: boolean },
  ) => Effect.Effect<void, AuthError>;

  readonly getCustomClaims: (uid: string) => Effect.Effect<{ admin?: boolean }, AuthError>;

  readonly verifyAdminClaim: (
    sessionCookie: string,
  ) => Effect.Effect<{ uid: string; email?: string; isAdmin: boolean }, AuthError | SessionError>;
}

// Service tag
export const AuthService = Context.GenericTag<AuthService>("AuthService");

// Implementation
const make = Effect.gen(function* () {
  const auth = yield* initializeFirebaseAdmin();

  return AuthService.of({
    verifyIdToken: (idToken) =>
      Effect.tryPromise({
        try: () => auth.verifyIdToken(idToken),
        catch: (error) =>
          new AuthError({
            code: "TOKEN_VERIFY_FAILED",
            message: "Failed to verify ID token",
            cause: error,
          }),
      }),

    createSessionCookie: (idToken, expiresIn) =>
      Effect.tryPromise({
        try: () => auth.createSessionCookie(idToken, { expiresIn }),
        catch: (error) =>
          new AuthError({
            code: "SESSION_CREATE_FAILED",
            message: "Failed to create session cookie",
            cause: error,
          }),
      }),

    verifySessionCookie: (sessionCookie) =>
      Effect.tryPromise({
        try: () => auth.verifySessionCookie(sessionCookie, true),
        catch: () =>
          new SessionError({
            code: "SESSION_INVALID",
            message: "Session is invalid or expired",
          }),
      }),

    revokeRefreshTokens: (uid) =>
      Effect.tryPromise({
        try: () => auth.revokeRefreshTokens(uid),
        catch: (error) =>
          new AuthError({
            code: "REVOKE_FAILED",
            message: "Failed to revoke refresh tokens",
            cause: error,
          }),
      }),

    getUser: (uid) =>
      Effect.tryPromise({
        try: async () => {
          const userRecord = await auth.getUser(uid);
          return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
          };
        },
        catch: (error) =>
          new AuthError({
            code: "GET_USER_FAILED",
            message: `Failed to get user ${uid}`,
            cause: error,
          }),
      }),

    setCustomClaims: (uid, claims) =>
      Effect.tryPromise({
        try: () => auth.setCustomUserClaims(uid, claims),
        catch: (error) =>
          new AuthError({
            code: "SET_CLAIMS_FAILED",
            message: `Failed to set custom claims for ${uid}`,
            cause: error,
          }),
      }),

    getCustomClaims: (uid) =>
      Effect.tryPromise({
        try: async () => {
          const user = await auth.getUser(uid);
          return { admin: user.customClaims?.admin || false };
        },
        catch: (error) =>
          new AuthError({
            code: "GET_CLAIMS_FAILED",
            message: `Failed to get custom claims for ${uid}`,
            cause: error,
          }),
      }),

    verifyAdminClaim: (sessionCookie) =>
      Effect.gen(function* () {
        const decoded = yield* Effect.tryPromise({
          try: () => auth.verifySessionCookie(sessionCookie, true),
          catch: () =>
            new SessionError({
              code: "SESSION_INVALID",
              message: "Session is invalid or expired",
            }),
        });

        return {
          uid: decoded.uid,
          email: decoded.email,
          isAdmin: decoded.admin === true,
        };
      }),
  });
});

// Live layer
export const AuthServiceLive = Layer.effect(AuthService, make);

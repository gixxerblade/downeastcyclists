# Rule 1: Effect-TS Client Utilities

## Title

Effect-TS Client Utilities Pattern

## Description

When creating client-side operations (Firebase auth, API calls, etc.), wrap them in Effect-TS utilities with typed errors instead of using raw promises or try/catch blocks.

## Pattern

### ❌ Avoid

```typescript
async function signIn(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  } catch (error) {
    throw new Error("Sign in failed");
  }
}
```

### ✅ Prefer

```typescript
import { Effect } from "effect";
import { AuthError } from "./errors";

export const signInWithPassword = (
  credentials: { email: string; password: string }
): Effect.Effect<UserCredential, AuthError> =>
  Effect.tryPromise({
    try: () => signInWithEmailAndPassword(
      auth, 
      credentials.email, 
      credentials.password
    ),
    catch: (error) =>
      new AuthError({
        code: "SIGN_IN_FAILED",
        message: error instanceof Error ? error.message : "Failed to sign in",
        cause: error,
      }),
  });
```

### For Multi-Step Operations

```typescript
export const loginWithPassword = (
  credentials: { email: string; password: string }
): Effect.Effect<SessionResponse, AuthError> =>
  Effect.gen(function* () {
    const userCredential = yield* signInWithPassword(credentials);
    const idToken = yield* Effect.tryPromise({
      try: () => userCredential.user.getIdToken(),
      catch: (error) => new AuthError({ 
        code: "TOKEN_GET_FAILED", 
        message: "Failed to get ID token",
        cause: error,
      }),
    });
    return yield* createSessionCookie(idToken);
  });
```

## Benefits

- Type-safe error handling with tagged errors
- Composable operations with automatic error propagation
- Consistent error types across server and client
- Better testability with mock Effects

## File Location

- Client utilities: `src/lib/effect/client-*.ts`
- Shared errors: `src/lib/effect/errors.ts`

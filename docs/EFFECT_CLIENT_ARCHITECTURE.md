# Effect-TS + TanStack Query Client Architecture

## Overview

This document explains how we integrate **Effect-TS** with **TanStack Query** on the client side for consistent, type-safe error handling across the entire application.

## Architecture Philosophy

### The Problem We Solved

**Before:** Inconsistent error handling between server and client

- ✅ Server: Beautiful Effect-TS with tagged errors
- ❌ Client: Raw fetch with try/catch and generic Error types

**After:** Unified Effect-TS across server and client

- ✅ Server: Effect-TS with tagged errors (`AuthError`, `StripeError`, etc.)
- ✅ Client: Effect-TS utilities wrapped in TanStack Query mutations
- ✅ Type-safe error handling everywhere

## Core Pattern

### Client-Side Effect Utilities

Instead of raw `fetch` calls, we create Effect utilities that:

1. Wrap Firebase/API calls in `Effect.tryPromise`
2. Return typed errors (`AuthError`, `StripeError`, etc.)
3. Compose multiple operations with `Effect.gen`

**Example: `src/lib/effect/client-auth.ts`**

```typescript
import { Effect } from "effect";
import { AuthError } from "./errors";

// Wrap Firebase operation in Effect
export const signInWithPassword = (
  credentials: { email: string; password: string }
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

// Compose multiple Effects
export const loginWithPassword = (
  credentials: { email: string; password: string }
): Effect.Effect<SessionResponse, AuthError> =>
  Effect.gen(function* () {
    const userCredential = yield* signInWithPassword(credentials);
    const idToken = yield* Effect.tryPromise({
      try: () => userCredential.user.getIdToken(),
      catch: (error) => new AuthError({ code: "TOKEN_GET_FAILED", ... }),
    });
    return yield* createSessionCookie(idToken);
  });
```

### Integrating with TanStack Query

Use `Effect.runPromise` in TanStack Query mutations:

```typescript
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {loginWithPassword} from '@/lib/effect/client-auth';
import type {AuthError} from '@/lib/effect/errors';

const loginMutation = useMutation<unknown, AuthError, LoginCredentials>({
  mutationFn: (credentials) => Effect.runPromise(loginWithPassword(credentials)),
  onSuccess: () => router.push('/member'),
});

// TypeScript knows error is AuthError!
loginMutation.error?.message; // ✅ Type-safe
loginMutation.error?.code; // ✅ Type-safe
```

## Benefits

### 1. **Type-Safe Error Handling**

```typescript
// ❌ Before: Generic Error
catch (err) {
  if (err instanceof Error) {
    setError(err.message); // Could be anything
  }
}

// ✅ After: Tagged AuthError
mutation.error?.code    // "SIGN_IN_FAILED" | "TOKEN_GET_FAILED" | ...
mutation.error?.message // Type-safe error message
```

### 2. **Consistent Patterns**

Same error types used everywhere:

- Server actions: `getMemberDashboard() -> MemberDashboardResponse | { error: string }`
- Client mutations: `loginMutation.error -> AuthError`
- API routes: `Effect.catchTag("AuthError", ...)`

### 3. **Composable Operations**

```typescript
// Chain multiple operations with automatic error propagation
const loginFlow = Effect.gen(function* () {
  const user = yield* signIn(credentials); // AuthError
  const token = yield* getToken(user); // AuthError
  const session = yield* createSession(token); // AuthError
  return session;
});
// If any step fails, the entire chain short-circuits with the error
```

### 4. **Better UX**

```typescript
// Loading states
{loginMutation.isPending && "Signing in..."}

// Error states
{loginMutation.error && (
  <Alert severity="error">
    {loginMutation.error.message}
  </Alert>
)}

// Success handling
onSuccess: () => router.push("/member")
```

## File Structure

```
src/lib/effect/
├── errors.ts              # Tagged error definitions (shared server/client)
├── schemas.ts             # Effect Schema types (shared server/client)
├── auth.service.ts        # Server-side auth (Firebase Admin)
├── stripe.service.ts      # Server-side Stripe operations
├── portal.service.ts      # Server-side portal business logic
├── client-auth.ts         # ✨ Client-side auth operations
└── client-portal.ts       # ✨ Client-side portal operations

src/components/
├── auth/
│   ├── LoginForm.tsx      # Uses client-auth Effects
│   └── AuthProvider.tsx
└── member/
    └── PortalButton.tsx   # Uses client-portal Effects

app/member/verify/
└── page.tsx               # Uses client-auth Effects
```

## Examples

### Example 1: Login Form

**File:** `src/components/auth/LoginForm.tsx`

```typescript
import { useMutation } from "@tanstack/react-query";
import { Effect } from "effect";
import { loginWithPassword } from "@/lib/effect/client-auth";

const loginMutation = useMutation<unknown, AuthError, LoginCredentials>({
  mutationFn: (credentials) =>
    Effect.runPromise(loginWithPassword(credentials)),
  onSuccess: () => router.push("/member"),
});

// Use it
<form onSubmit={(e) => {
  e.preventDefault();
  loginMutation.mutate({ email, password });
}}>
  {loginMutation.error && (
    <Alert severity="error">{loginMutation.error.message}</Alert>
  )}
  <Button disabled={loginMutation.isPending}>
    {loginMutation.isPending ? "Signing in..." : "Sign In"}
  </Button>
</form>
```

### Example 2: Portal Button

**File:** `src/components/member/PortalButton.tsx`

```typescript
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {createPortalSession} from '@/lib/effect/client-portal';

const portalMutation = useMutation<{url: string}, StripeError | NotFoundError, void>({
  mutationFn: () => Effect.runPromise(createPortalSession(returnUrl)),
  onSuccess: (data) => router.push(data.url),
});

// TypeScript knows error could be StripeError or NotFoundError
if (portalMutation.error?._tag === 'NotFoundError') {
  // Handle no customer found
} else if (portalMutation.error?._tag === 'StripeError') {
  // Handle Stripe error
}
```

### Example 3: Magic Link Verification

**File:** `app/member/verify/page.tsx`

```typescript
const verifyMutation = useMutation<unknown, AuthError, string>({
  mutationFn: (email) => Effect.runPromise(completeMagicLinkSignIn(email, window.location.href)),
  onSuccess: () => router.replace('/member'),
});

// Effect composition for multi-step verification
const completeMagicLinkSignIn = (email: string, link: string) =>
  Effect.gen(function* () {
    const userCred = yield* signInWithLink(email, link);
    yield* clearStoredEmail();
    const token = yield* getIdToken(userCred);
    return yield* createSession(token);
  });
```

## Testing Benefits

Effect-TS makes testing easier:

```typescript
// Test the Effect without running it
const mockAuth = {
  signInWithPassword: () => Effect.succeed(mockUserCredential),
  createSessionCookie: () => Effect.succeed({success: true}),
};

// Test error cases
const failingAuth = {
  signInWithPassword: () =>
    Effect.fail(
      new AuthError({
        code: 'SIGN_IN_FAILED',
        message: 'Invalid credentials',
      }),
    ),
};
```

## Migration Guide

### Migrating from raw fetch to Effect

**Before:**

```typescript
const handleLogin = async () => {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({idToken}),
    });
    if (!response.ok) throw new Error('Failed');
    router.push('/member');
  } catch (err) {
    setError(err.message);
  }
};
```

**After:**

```typescript
import {useMutation} from '@tanstack/react-query';
import {createSessionCookie} from '@/lib/effect/client-auth';

const sessionMutation = useMutation({
  mutationFn: (idToken: string) => Effect.runPromise(createSessionCookie(idToken)),
  onSuccess: () => router.push('/member'),
});

sessionMutation.mutate(idToken);
```

## Best Practices

1. **Always use typed errors** - Don't catch with generic `Error`
2. **Compose with Effect.gen** - For multi-step operations
3. **Use Effect.runPromise in mutations** - Let TanStack Query handle state
4. **Share error types** - Same `AuthError` on server and client
5. **Handle specific error tags** - `Effect.catchTag("AuthError", ...)`

## Future Improvements

- [ ] Add Effect-based queries (not just mutations)
- [ ] Create reusable Effect hooks (`useEffectMutation`)
- [ ] Add Effect middleware for logging/monitoring
- [ ] Create Effect-based form validation

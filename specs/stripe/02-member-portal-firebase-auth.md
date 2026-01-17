# Plan: Member Portal with Firebase Auth - Phase 2 (Effect-TS Refactored)

## Task Description

Implement a member-only portal with Firebase Authentication, enabling members to view their membership status, manage subscriptions via Stripe Customer Portal, and access member-exclusive content — all orchestrated with **Effect-TS** for type-safe data flow and error handling.

## Objective

Deliver a secure member portal that:

- Authenticates users via Firebase Auth (email/password + magic link)
- Displays real-time membership status from Firestore
- Allows subscription management through Stripe Customer Portal
- Protects member-only routes and content
- Integrates seamlessly with the Effect services built in Phase 1

**Effect-TS Integration Goals:**

- AuthService wraps Firebase Admin Auth operations
- PortalService orchestrates auth + membership logic
- Server actions use Effect.runPromise with proper error boundaries
- Client-side hooks integrate with Effect for async state management

## Problem Statement

Members need a secure way to:

1. Sign in to view their membership details
2. Update payment methods and cancel subscriptions
3. Access member-exclusive content and benefits
4. See their membership renewal dates

## Solution Approach

1. **Leverage Phase 1 services**: Reuse `FirestoreService` and `MembershipService` from Phase 1
2. **Add AuthService**: New Effect service for Firebase Admin Auth operations
3. **Server components**: Fetch membership data server-side with Effect
4. **Client interactions**: Auth state management and portal redirects

## Effect-TS Layer Architecture (Phase 2 Extension)

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Member Portal (Next.js)                      │
│      Server Components + Client Components + Server Actions     │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PortalService                              │
│    (Business logic for member portal operations)                │
│    - getPortalSession (Stripe Customer Portal)                  │
│    - getMemberDashboard                                         │
│    - linkFirebaseToStripe                                       │
└─────────────────────────────────────────────────────────────────┘
           │                │                       │
           ▼                ▼                       ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
│ AuthService │   │ MembershipServic│   │    StripeService        │
│(Firebase)   │   │ (from Phase 1)  │   │    (from Phase 1)       │
└─────────────┘   └─────────────────┘   └─────────────────────────┘
```

## Relevant Files

### Existing Files (from Phase 1)

- `src/lib/effect/stripe.service.ts` - StripeService (extend for Customer Portal)
- `src/lib/effect/firestore.service.ts` - FirestoreService
- `src/lib/effect/membership.service.ts` - MembershipService
- `src/lib/effect/errors.ts` - Tagged error types
- `src/lib/effect/schemas.ts` - Effect Schema definitions
- `src/lib/effect/layers.ts` - Layer composition
- `src/utils/firebase.ts:1-56` - Client-side Firebase config (reference only)
- `middleware.ts:1-72` - Auth middleware patterns

### New Files to Create

#### Effect Services

- `src/lib/effect/auth.service.ts` - AuthService (Firebase Admin Auth)
- `src/lib/effect/portal.service.ts` - PortalService (portal business logic)

#### Authentication

- `src/lib/firebase-admin.ts` - Firebase Admin SDK initialization
- `src/lib/auth/session.ts` - Session cookie management

#### API Routes

- `app/api/auth/session/route.ts` - Create/verify session cookies
- `app/api/portal/route.ts` - Create Stripe Customer Portal session

#### Server Actions

- `src/actions/auth.ts` - Auth server actions (sign in, sign out)
- `src/actions/portal.ts` - Portal server actions (get dashboard data)

#### UI Components

- `app/member/page.tsx` - Member dashboard page
- `app/member/layout.tsx` - Protected layout with auth check
- `src/components/auth/LoginForm.tsx` - Login form component
- `src/components/auth/AuthProvider.tsx` - Client auth context
- `src/components/member/MembershipCard.tsx` - Membership status display
- `src/components/member/PortalButton.tsx` - Stripe portal redirect

## Step by Step Tasks

### 1. Install Additional Dependencies

```bash
pnpm add firebase-admin
```

### 2. Add AuthError to Tagged Errors

Update `src/lib/effect/errors.ts`:

```typescript
// Add to existing errors file

export class AuthError extends Data.TaggedError('AuthError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SessionError extends Data.TaggedError('SessionError')<{
  readonly code: string;
  readonly message: string;
}> {}

// Update union type
export type AppError =
  | StripeError
  | FirestoreError
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | AuthError
  | SessionError;
```

### 3. Add Auth-Related Schemas

Update `src/lib/effect/schemas.ts`:

```typescript
// Add to existing schemas file

// Session schema
export const SessionData = S.Struct({
  uid: S.String,
  email: S.NullOr(S.String),
  emailVerified: S.Boolean,
  expiresAt: S.Number,
});
export type SessionData = S.Schema.Type<typeof SessionData>;

// Portal session request
export const PortalSessionRequest = S.Struct({
  userId: S.String,
  returnUrl: S.String,
});
export type PortalSessionRequest = S.Schema.Type<typeof PortalSessionRequest>;

// Member dashboard response
export const MemberDashboardResponse = S.Struct({
  user: S.Struct({
    id: S.String,
    email: S.String,
    name: S.NullOr(S.String),
  }),
  membership: S.NullOr(
    S.Struct({
      planType: PlanType,
      planName: S.String,
      status: MembershipStatus,
      startDate: S.String,
      endDate: S.String,
      autoRenew: S.Boolean,
      daysRemaining: S.Number,
    }),
  ),
  canManageSubscription: S.Boolean,
});
export type MemberDashboardResponse = S.Schema.Type<typeof MemberDashboardResponse>;
```

### 4. Initialize Firebase Admin SDK

Create `src/lib/firebase-admin.ts`:

```typescript
import {Effect} from 'effect';
import {initializeApp, getApps, cert, App} from 'firebase-admin/app';
import {getAuth, Auth} from 'firebase-admin/auth';
import {AuthError} from './effect/errors';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

const initializeFirebaseAdmin = (): Effect.Effect<Auth, AuthError> =>
  Effect.try({
    try: () => {
      if (adminAuth) return adminAuth;

      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!privateKey) {
        throw new Error('FIREBASE_ADMIN_PRIVATE_KEY not configured');
      }

      if (getApps().length === 0) {
        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey,
          }),
        });
      } else {
        adminApp = getApps()[0];
      }

      adminAuth = getAuth(adminApp);
      return adminAuth;
    },
    catch: (error) =>
      new AuthError({
        code: 'ADMIN_INIT_FAILED',
        message: 'Failed to initialize Firebase Admin',
        cause: error,
      }),
  });

export {initializeFirebaseAdmin};
```

### 5. Create AuthService

Create `src/lib/effect/auth.service.ts`:

```typescript
import {Context, Effect, Layer} from 'effect';
import type {Auth, DecodedIdToken} from 'firebase-admin/auth';
import {initializeFirebaseAdmin} from '../firebase-admin';
import {AuthError, SessionError} from './errors';

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
    {uid: string; email: string | undefined; displayName: string | undefined},
    AuthError
  >;
}

// Service tag
export const AuthService = Context.GenericTag<AuthService>('AuthService');

// Implementation
const make = Effect.gen(function* () {
  const auth = yield* initializeFirebaseAdmin();

  return AuthService.of({
    verifyIdToken: (idToken) =>
      Effect.tryPromise({
        try: () => auth.verifyIdToken(idToken),
        catch: (error) =>
          new AuthError({
            code: 'TOKEN_VERIFY_FAILED',
            message: 'Failed to verify ID token',
            cause: error,
          }),
      }),

    createSessionCookie: (idToken, expiresIn) =>
      Effect.tryPromise({
        try: () => auth.createSessionCookie(idToken, {expiresIn}),
        catch: (error) =>
          new AuthError({
            code: 'SESSION_CREATE_FAILED',
            message: 'Failed to create session cookie',
            cause: error,
          }),
      }),

    verifySessionCookie: (sessionCookie) =>
      Effect.tryPromise({
        try: () => auth.verifySessionCookie(sessionCookie, true),
        catch: (error) =>
          new SessionError({
            code: 'SESSION_INVALID',
            message: 'Session is invalid or expired',
          }),
      }),

    revokeRefreshTokens: (uid) =>
      Effect.tryPromise({
        try: () => auth.revokeRefreshTokens(uid),
        catch: (error) =>
          new AuthError({
            code: 'REVOKE_FAILED',
            message: 'Failed to revoke refresh tokens',
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
            code: 'GET_USER_FAILED',
            message: `Failed to get user ${uid}`,
            cause: error,
          }),
      }),
  });
});

// Live layer
export const AuthServiceLive = Layer.effect(AuthService, make);
```

### 6. Extend StripeService for Customer Portal

Update `src/lib/effect/stripe.service.ts` - add to interface and implementation:

```typescript
// Add to StripeService interface
readonly createPortalSession: (
  customerId: string,
  returnUrl: string
) => Effect.Effect<Stripe.BillingPortal.Session, StripeError>;

// Add to implementation (inside StripeService.of)
createPortalSession: (customerId, returnUrl) =>
  Effect.tryPromise({
    try: () =>
      stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      }),
    catch: (error) =>
      new StripeError({
        code: "PORTAL_CREATE_FAILED",
        message: "Failed to create customer portal session",
        cause: error,
      }),
  }),
```

### 7. Create PortalService

Create `src/lib/effect/portal.service.ts`:

```typescript
import {Context, Effect, Layer, pipe} from 'effect';
import {AuthService} from './auth.service';
import {StripeService} from './stripe.service';
import {FirestoreService} from './firestore.service';
import {AuthError, SessionError, StripeError, FirestoreError, NotFoundError} from './errors';
import type {MemberDashboardResponse} from './schemas';

// Service interface
export interface PortalService {
  readonly verifySession: (
    sessionCookie: string,
  ) => Effect.Effect<{uid: string; email: string | undefined}, SessionError | AuthError>;

  readonly getMemberDashboard: (
    userId: string,
  ) => Effect.Effect<MemberDashboardResponse, FirestoreError | NotFoundError>;

  readonly createPortalSession: (
    userId: string,
    returnUrl: string,
  ) => Effect.Effect<{url: string}, StripeError | FirestoreError | NotFoundError>;

  readonly linkFirebaseToStripe: (
    firebaseUid: string,
    stripeCustomerId: string,
  ) => Effect.Effect<void, FirestoreError>;
}

// Service tag
export const PortalService = Context.GenericTag<PortalService>('PortalService');

// Implementation using Effect.gen for complex orchestration
const make = Effect.gen(function* () {
  const auth = yield* AuthService;
  const stripe = yield* StripeService;
  const firestore = yield* FirestoreService;

  return PortalService.of({
    // Session verification - simple transform, use Effect.pipe
    verifySession: (sessionCookie) =>
      pipe(
        auth.verifySessionCookie(sessionCookie),
        Effect.map((decoded) => ({
          uid: decoded.uid,
          email: decoded.email,
        })),
      ),

    // Dashboard - complex with multiple dependent calls, use Effect.gen
    getMemberDashboard: (userId) =>
      Effect.gen(function* () {
        // Fetch user
        const user = yield* firestore.getUser(userId);
        if (!user) {
          return yield* Effect.fail(new NotFoundError({resource: 'user', id: userId}));
        }

        // Fetch membership
        const membership = yield* firestore.getActiveMembership(userId);

        let membershipData: MemberDashboardResponse['membership'] = null;
        let canManageSubscription = false;

        if (membership) {
          // Calculate days remaining
          const endDate = membership.endDate.toDate?.() || new Date(membership.endDate as any);
          const now = new Date();
          const daysRemaining = Math.max(
            0,
            Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          );

          const plan = yield* firestore.getPlan(membership.planType);
          const planName =
            plan?.name ||
            (membership.planType === 'family'
              ? 'Family Annual Membership'
              : 'Individual Annual Membership');

          const startDate =
            membership.startDate.toDate?.() || new Date(membership.startDate as any);

          membershipData = {
            planType: membership.planType,
            planName,
            status: membership.status,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            autoRenew: membership.autoRenew,
            daysRemaining,
          };

          canManageSubscription = !!user.stripeCustomerId;
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name || null,
          },
          membership: membershipData,
          canManageSubscription,
        };
      }),

    // Portal session - sequential dependent calls, use Effect.gen
    createPortalSession: (userId, returnUrl) =>
      Effect.gen(function* () {
        // Get user to find Stripe customer ID
        const user = yield* firestore.getUser(userId);

        if (!user) {
          return yield* Effect.fail(new NotFoundError({resource: 'user', id: userId}));
        }

        if (!user.stripeCustomerId) {
          return yield* Effect.fail(
            new NotFoundError({
              resource: 'stripeCustomer',
              id: userId,
            }),
          );
        }

        // Create portal session
        const session = yield* stripe.createPortalSession(user.stripeCustomerId, returnUrl);

        yield* Effect.log(`Portal session created for user ${userId}: ${session.id}`);

        return {url: session.url};
      }),

    // Simple delegation, use Effect.pipe
    linkFirebaseToStripe: (firebaseUid, stripeCustomerId) =>
      firestore.setUser(firebaseUid, {stripeCustomerId}),
  });
});

// Live layer - requires AuthService, StripeService, FirestoreService
export const PortalServiceLive = Layer.effect(PortalService, make);
```

### 8. Update Layer Composition

Update `src/lib/effect/layers.ts`:

```typescript
import {Layer} from 'effect';
import {StripeService, StripeServiceLive} from './stripe.service';
import {FirestoreService, FirestoreServiceLive} from './firestore.service';
import {MembershipService, MembershipServiceLive} from './membership.service';
import {AuthService, AuthServiceLive} from './auth.service';
import {PortalService, PortalServiceLive} from './portal.service';

// Base services layer (no dependencies)
const BaseServicesLayer = Layer.mergeAll(StripeServiceLive, FirestoreServiceLive, AuthServiceLive);

// Membership service (depends on Stripe + Firestore)
const MembershipLayer = MembershipServiceLive.pipe(
  Layer.provide(StripeServiceLive),
  Layer.provide(FirestoreServiceLive),
);

// Portal service (depends on Auth + Stripe + Firestore)
const PortalLayer = PortalServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(StripeServiceLive),
  Layer.provide(FirestoreServiceLive),
);

// Complete live layer with all services
export const LiveLayer = Layer.mergeAll(BaseServicesLayer, MembershipLayer, PortalLayer);

// Re-export individual layers for selective use
export {BaseServicesLayer, MembershipLayer, PortalLayer};
```

### 9. Create Session API Route

Create `app/api/auth/session/route.ts`:

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {AuthService, AuthServiceLive} from '@/src/lib/effect/auth.service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: NextRequest) {
  const {idToken} = await request.json();

  if (!idToken) {
    return NextResponse.json({error: 'ID token is required'}, {status: 400});
  }

  const program = pipe(
    Effect.gen(function* () {
      const auth = yield* AuthService;

      // Verify the ID token first
      yield* auth.verifyIdToken(idToken);

      // Create session cookie
      const sessionCookie = yield* auth.createSessionCookie(idToken, SESSION_EXPIRES_IN);

      return sessionCookie;
    }),

    Effect.catchTag('AuthError', (error) =>
      Effect.succeed({
        error: error.message,
        _tag: 'error' as const,
        status: 401,
      }),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(AuthServiceLive)));

  if (typeof result === 'object' && '_tag' in result) {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  // Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, result, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRES_IN / 1000,
    path: '/',
  });

  return NextResponse.json({success: true});
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({success: true});
}
```

### 10. Create Portal Session API Route

Create `app/api/portal/route.ts`:

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {PortalService} from '@/src/lib/effect/portal.service';
import {LiveLayer} from '@/src/lib/effect/layers';

export async function POST(request: NextRequest) {
  const {returnUrl} = await request.json();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  if (!returnUrl) {
    return NextResponse.json({error: 'Return URL is required'}, {status: 400});
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;

      // Verify session and get user ID
      const session = yield* portal.verifySession(sessionCookie);

      // Create portal session
      return yield* portal.createPortalSession(session.uid, returnUrl);
    }),

    Effect.catchTag('SessionError', () =>
      Effect.succeed({
        error: 'Session expired',
        _tag: 'error' as const,
        status: 401,
      }),
    ),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: `No ${error.resource} found`,
        _tag: 'error' as const,
        status: 404,
      }),
    ),
    Effect.catchTag('StripeError', (error) =>
      Effect.succeed({
        error: error.message,
        _tag: 'error' as const,
        status: 500,
      }),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}
```

### 11. Create Auth Server Actions

Create `src/actions/auth.ts`:

```typescript
'use server';

import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {PortalService} from '@/lib/effect/portal.service';
import {LiveLayer} from '@/lib/effect/layers';

export type AuthState = {
  error?: string;
  success?: boolean;
};

// Verify current session - use Effect.catchAll for safe fallback
export async function verifySession(): Promise<{
  authenticated: boolean;
  userId?: string;
  email?: string;
}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return {authenticated: false};
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const session = yield* portal.verifySession(sessionCookie);
      return {
        authenticated: true as const,
        userId: session.uid,
        email: session.email,
      };
    }),

    Effect.catchAll(() => Effect.succeed({authenticated: false as const})),
  );

  return Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
}

// Sign out action
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  redirect('/login');
}

// Get current user from session
export async function getCurrentUser() {
  const session = await verifySession();

  if (!session.authenticated || !session.userId) {
    return null;
  }

  return {
    uid: session.userId,
    email: session.email,
  };
}
```

### 12. Create Portal Server Actions

Create `src/actions/portal.ts`:

```typescript
'use server';

import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {PortalService} from '@/lib/effect/portal.service';
import {LiveLayer} from '@/lib/effect/layers';
import type {MemberDashboardResponse} from '@/lib/effect/schemas';

// Get member dashboard data - Effect.gen for complex flow
export async function getMemberDashboard(): Promise<MemberDashboardResponse | {error: string}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;

      // Verify session
      const session = yield* portal.verifySession(sessionCookie);

      // Get dashboard data
      return yield* portal.getMemberDashboard(session.uid);
    }),

    Effect.catchTag('SessionError', () => {
      redirect('/login');
    }),
    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: `${error.resource} not found`,
      }),
    ),
    Effect.catchTag('FirestoreError', (error) =>
      Effect.succeed({
        error: error.message,
      }),
    ),
  );

  return Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
}

// Redirect to Stripe Customer Portal
export async function redirectToPortal(returnUrl: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;

      // Verify session
      const session = yield* portal.verifySession(sessionCookie);

      // Create portal session
      const result = yield* portal.createPortalSession(session.uid, returnUrl);
      return result.url;
    }),

    Effect.catchTag('SessionError', () => {
      redirect('/login');
    }),
    Effect.catchTag('NotFoundError', () => Effect.succeed(null as string | null)),
    Effect.catchTag('StripeError', () => Effect.succeed(null as string | null)),
  );

  const portalUrl = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if (portalUrl) {
    redirect(portalUrl);
  }
}
```

### 13. Create Auth Provider Component

Create `src/components/auth/AuthProvider.tsx`:

```typescript
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { auth } from "@/utils/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get ID token and create session
        const idToken = await firebaseUser.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        setUser(firebaseUser);
      } else {
        // Clear session
        await fetch("/api/auth/session", { method: "DELETE" });
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

### 14. Create Login Form Component

Create `src/components/auth/LoginForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "@/utils/firebase";
import { Box, Button, TextField, Typography, Alert, Divider } from "@mui/material";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Create session
      const idToken = await userCredential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      router.push("/member");
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/member/verify`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <Box textAlign="center">
        <Typography variant="h6" gutterBottom>
          Check your email
        </Typography>
        <Typography color="text.secondary">
          We sent a sign-in link to {email}
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleEmailPasswordLogin}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="normal"
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? "Signing in..." : "Sign In"}
      </Button>

      <Divider sx={{ my: 3 }}>or</Divider>

      <Button
        fullWidth
        variant="outlined"
        onClick={handleMagicLink}
        disabled={loading}
      >
        Send Magic Link
      </Button>
    </Box>
  );
}
```

### 15-20. UI Components and Pages

_[See Phase 1 for detailed component implementations - MembershipCard, PortalButton, Member Dashboard Page, Protected Layout, Login Page, Middleware updates]_

## Effect-TS Pattern Guide (Phase 2)

### When to Use Effect.pipe vs Effect.gen

| Scenario                   | Pattern                    | Example                                            |
| -------------------------- | -------------------------- | -------------------------------------------------- |
| Simple transform           | `Effect.pipe`              | `verifySession` - decode token then map            |
| Sequential dependent calls | `Effect.gen`               | `getMemberDashboard` - fetch user, then membership |
| Error handling chain       | `Effect.pipe` + `catchTag` | API routes with multiple error types               |
| Parallel independent calls | `Effect.all`               | Fetch user + plans simultaneously                  |

### Server Actions Pattern

```typescript
// Use Effect.gen for complex server actions
export async function getMemberDashboard() {
  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const session = yield* portal.verifySession(cookie);
      return yield* portal.getMemberDashboard(session.uid);
    }),
    Effect.catchTag('SessionError', () => redirect('/login')),
    Effect.catchTag('NotFoundError', (e) => Effect.succeed({error: e.message})),
  );

  return Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
}
```

### Client-Side Auth State

```typescript
// Client components use Firebase client SDK directly
// Session cookies are managed via API routes
const {user, loading, signOut} = useAuth();
```

### Protected Routes Pattern

```typescript
// In layout.tsx - verify session server-side
const session = await Effect.runPromise(
  portal.verifySession(cookie).pipe(Effect.provide(LiveLayer)),
);

if (!session) redirect('/login');
```

## Acceptance Criteria

- [ ] `AuthService` implemented with Firebase Admin SDK operations
- [ ] `PortalService` implemented for member portal business logic
- [ ] Session cookie management via API routes (`/api/auth/session`)
- [ ] Customer Portal redirect via `/api/portal` endpoint
- [ ] Server actions use `Effect.runPromise` with proper error handling
- [ ] Protected `/member` route with server-side session verification
- [ ] `AuthProvider` manages client-side auth state
- [ ] Login form supports email/password and magic link
- [ ] Membership card displays status, dates, auto-renew
- [ ] Portal button redirects to Stripe Customer Portal
- [ ] All error handling uses `Effect.catchTag`
- [ ] No session data exposed to client except through controlled APIs
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)

## Validation Commands

```bash
# Install dependencies
pnpm add firebase-admin

# Verify TypeScript compilation
pnpm tsc --noEmit

# Build Next.js
pnpm build

# Test session creation
curl -X POST http://localhost:3000/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"idToken":"..."}'

# Test portal redirect (requires valid session cookie)
curl -X POST http://localhost:3000/api/portal \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"returnUrl":"http://localhost:3000/member"}'
```

## Environment Variables Required

```env
# Firebase Admin (add to existing)
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Notes

- Session cookies are HTTP-only for security
- Firebase Admin SDK runs server-side only
- Client-side auth state syncs with server via API routes
- Stripe Customer Portal handles all subscription management UI
- Magic link authentication provides passwordless option

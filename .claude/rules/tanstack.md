# Rule 2: TanStack Query with Effect-TS

## Title

TanStack Query Integration with Effect-TS

## Description

When using TanStack Query (both queries and mutations), integrate Effect-TS utilities using `Effect.runPromise` to maintain type-safe error handling and consistent patterns.

## Pattern: Mutations

### ❌ Avoid

```typescript
const loginMutation = useMutation({
  mutationFn: async (credentials) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      if (!response.ok) throw new Error("Login failed");
      return response.json();
    } catch (err) {
      throw err;
    }
  },
});

// Error is generic Error type
loginMutation.error?.message // any string
```

### ✅ Prefer

```typescript
import { useMutation } from "@tanstack/react-query";
import { Effect } from "effect";
import { loginWithPassword } from "@/lib/effect/client-auth";
import type { AuthError } from "@/lib/effect/errors";

const loginMutation = useMutation
  SessionResponse,
  AuthError,
  LoginCredentials
>({
  mutationFn: (credentials) =>
    Effect.runPromise(loginWithPassword(credentials)),
  onSuccess: () => router.push("/member"),
});

// TypeScript knows error is AuthError
loginMutation.error?.code     // ✅ Type-safe: "SIGN_IN_FAILED" | "TOKEN_GET_FAILED"
loginMutation.error?.message  // ✅ Type-safe error message
```

### Mutation Usage in Components

```typescript
<form onSubmit={(e) => {
  e.preventDefault();
  loginMutation.mutate({ email, password });
}}>
  {loginMutation.error && (
    <Alert severity="error">
      {loginMutation.error.message}
    </Alert>
  )}
  
  <Button disabled={loginMutation.isPending}>
    {loginMutation.isPending ? "Signing in..." : "Sign In"}
  </Button>
</form>
```

## Pattern: Queries

### ❌ Avoid

```typescript
const { data, error } = useQuery({
  queryKey: ["member", userId],
  queryFn: async () => {
    try {
      const response = await fetch(`/api/member/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    } catch (err) {
      throw err;
    }
  },
});

// Error is generic Error type
error?.message // any string
```

### ✅ Prefer

```typescript
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { getMemberDashboard } from "@/lib/effect/client-portal";
import type { NotFoundError, DatabaseError } from "@/lib/effect/errors";

const { data, error, isLoading } = useQuery
  MemberDashboard,
  NotFoundError | DatabaseError
>({
  queryKey: ["member-dashboard", userId],
  queryFn: () =>
    Effect.runPromise(getMemberDashboard(userId)),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// TypeScript knows error types
error?.code // ✅ Type-safe: "NOT_FOUND" | "DATABASE_ERROR"
```

### Query Usage in Components

```typescript
function MemberDashboard({ userId }: { userId: string }) {
  const { data, error, isLoading } = useQuery
    MemberDashboard,
    NotFoundError | DatabaseError
  >({
    queryKey: ["member-dashboard", userId],
    queryFn: () => Effect.runPromise(getMemberDashboard(userId)),
  });

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    if (error._tag === "NotFoundError") {
      return <Alert severity="warning">Member not found</Alert>;
    }
    return <Alert severity="error">{error.message}</Alert>;
  }

  return <Dashboard data={data} />;
}
```

### Query with Parameters

```typescript
const { data, error } = useQuery
  Member[],
  DatabaseError,
  Member[],
  [string, MemberFilters]
>({
  queryKey: ["members", filters] as const,
  queryFn: ({ queryKey }) => {
    const [, filters] = queryKey;
    return Effect.runPromise(searchMembers(filters));
  },
});
```

## Handling Multiple Error Types

### In Mutations

```typescript
const portalMutation = useMutation
  { url: string },
  StripeError | NotFoundError,
  void
>({
  mutationFn: () => Effect.runPromise(createPortalSession(returnUrl)),
  onSuccess: (data) => router.push(data.url),
});

// Handle specific error tags
if (portalMutation.error?._tag === "NotFoundError") {
  // Handle no customer found
} else if (portalMutation.error?._tag === "StripeError") {
  // Handle Stripe error
}
```

### In Queries

```typescript
const { data, error } = useQuery
  MemberData,
  AuthError | NotFoundError | DatabaseError
>({
  queryKey: ["member", memberId],
  queryFn: () => Effect.runPromise(getMember(memberId)),
});

// Type-safe error handling
if (error?._tag === "AuthError") {
  // Redirect to login
} else if (error?._tag === "NotFoundError") {
  // Show 404
} else if (error?._tag === "DatabaseError") {
  // Show error message
}
```

## Benefits

- Type-safe error handling in React components
- Automatic loading and error states from TanStack Query
- Consistent error types across queries and mutations
- Better UX with proper loading/error/success states
- Proper caching and refetching with queries

## Best Practices

- Always define generic types: `useQuery<DataType, ErrorType>` and `useMutation<SuccessType, ErrorType, VariablesType>`
- Use `Effect.runPromise` in `queryFn` and `mutationFn`
- Handle errors with type-safe `error?._tag` or `error?.code`
- Use proper query keys for caching: `["resource", id, filters]`
- Set appropriate `staleTime` for queries to reduce unnecessary refetches

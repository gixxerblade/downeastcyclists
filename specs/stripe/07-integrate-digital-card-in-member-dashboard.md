# Plan: Integrate Digital Membership Card in Member Dashboard

## Task Description

Integrate the existing `DigitalCard` component into the member dashboard so users can view their digital membership card with QR code at the `/member` route. The component and API endpoint already exist but are not connected.

## Objective

Enable members to view their digital membership card with QR code directly in the member dashboard, providing them with scannable proof of membership for events and partner locations.

## Problem Statement

The digital membership proof system (Phase 3) created the necessary components and API:

- `DigitalCard` component at `src/components/member/DigitalCard.tsx:22-127`
- API endpoint at `app/api/membership/card/route.ts:8-51`
- `MembershipCardService` for card data retrieval at `src/lib/effect/card.service.ts:13-34`

However, these are not integrated into the member dashboard. Members currently only see a basic membership overview (`MembershipCard` component) without access to their digital card with QR code.

## Solution Approach

Following the established Effect-TS + TanStack Query architecture documented in `docs/EFFECT_CLIENT_ARCHITECTURE.md`, we will:

1. **Create a client-side Effect utility** (`src/lib/effect/client-card.ts`) that wraps the card API endpoint with typed errors
2. **Use TanStack Query's `useQuery`** in `MemberDashboardClient` to fetch and cache card data
3. **Display the `DigitalCard` component** when data is available, using existing loading skeleton support

This follows the same pattern used in:

- `src/lib/effect/client-portal.ts:14-61` - Effect wrapper for portal API
- `src/components/member/PortalButton.tsx:19-29` - TanStack Query mutation consuming Effect

## Relevant Files

### New Files to Create

- `src/lib/effect/client-card.ts` - Client-side Effect utility for fetching digital card data

### Existing Files to Modify

- `src/components/member/MemberDashboardClient.tsx:1-165` - Add useQuery for digital card and render DigitalCard component

### Existing Files (Reference Only - No Changes)

- `src/components/member/DigitalCard.tsx:22-127` - Digital card component with QR code (already complete)
- `app/api/membership/card/route.ts:8-51` - API endpoint returning card data (already complete)
- `src/lib/effect/schemas.ts:191-206` - Contains `MembershipCard` type definition
- `src/lib/effect/errors.ts:60-70` - Contains `CardError` tagged error
- `src/lib/effect/client-portal.ts:14-61` - Reference pattern for client Effect utilities
- `src/components/member/PortalButton.tsx:19-29` - Reference pattern for TanStack Query + Effect
- `docs/EFFECT_CLIENT_ARCHITECTURE.md` - Architecture documentation

## Step by Step Tasks

### 1. Create Client-Side Effect Utility for Card Data

Create `src/lib/effect/client-card.ts` following the pattern in `client-portal.ts`:

```typescript
import {Effect} from 'effect';
import {CardError, NotFoundError, SessionError} from './errors';
import type {MembershipCard} from './schemas';

/**
 * Client-side card operations using Effect-TS
 * Wraps client-side API calls with Effect for consistent error handling
 */

interface CardResponse {
  hasCard: boolean;
  card: MembershipCard | null;
}

// Fetch digital membership card
export const getDigitalCard = (): Effect.Effect<
  CardResponse,
  CardError | NotFoundError | SessionError
> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch('/api/membership/card');

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 401) {
          throw new SessionError({
            code: 'SESSION_EXPIRED',
            message: data.error || 'Session expired',
          });
        }

        if (response.status === 404) {
          throw new NotFoundError({
            resource: 'membershipCard',
            id: 'current_user',
          });
        }

        throw new CardError({
          code: 'CARD_FETCH_FAILED',
          message: data.error || 'Failed to fetch membership card',
        });
      }

      return response.json();
    },
    catch: (error) => {
      // If it's already a tagged error, re-throw it
      if (
        error &&
        typeof error === 'object' &&
        '_tag' in error &&
        (error._tag === 'NotFoundError' ||
          error._tag === 'CardError' ||
          error._tag === 'SessionError')
      ) {
        return error as CardError | NotFoundError | SessionError;
      }

      // Otherwise wrap in CardError
      return new CardError({
        code: 'CARD_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to request card',
        cause: error,
      });
    },
  });
```

### 2. Update MemberDashboardClient Imports

Add required imports at the top of `src/components/member/MemberDashboardClient.tsx`:

```typescript
// Add to existing imports
import {useQuery} from '@tanstack/react-query';
import {Effect} from 'effect';
import {DigitalCard} from './DigitalCard';
import {getDigitalCard} from '@/src/lib/effect/client-card';
import type {CardError, NotFoundError, SessionError} from '@/src/lib/effect/errors';
```

### 3. Add useQuery for Digital Card Data

Inside `MemberDashboardClient` component, add the useQuery hook after existing state declarations (around line 32):

```typescript
// Fetch digital card using Effect + TanStack Query
// Only enabled when user has an active membership
const cardQuery = useQuery<
  {hasCard: boolean; card: MembershipCard | null},
  CardError | NotFoundError | SessionError
>({
  queryKey: ['digitalCard'],
  queryFn: () => Effect.runPromise(getDigitalCard()),
  // Only fetch when membership exists and not in error state
  enabled: !('error' in data) && !!data.membership,
  // Refetch when window regains focus (e.g., returning from Stripe)
  refetchOnWindowFocus: true,
  // Don't retry on 401/404 errors
  retry: (failureCount, error) => {
    if (error._tag === 'SessionError' || error._tag === 'NotFoundError') {
      return false;
    }
    return failureCount < 2;
  },
});
```

### 4. Refetch Card After Polling Completes

In the existing polling useEffect (around line 45-76), add card refetch when membership appears:

```typescript
// Inside the polling success handler, after setData(freshData):
if (freshData.membership) {
  setIsPolling(false);
  // Refetch the digital card now that membership exists
  cardQuery.refetch();
}
```

### 5. Render Digital Card Section

Update the membership section render (around line 134-144) to include the digital card:

```typescript
{membership ? (
  <Box sx={{ mb: 3 }}>
    {/* Membership Overview */}
    <Typography variant="h6" gutterBottom>
      Membership Overview
    </Typography>
    <MembershipCard membership={membership} />

    {/* Digital Card Section */}
    <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
      Your Digital Membership Card
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Show this QR code to verify your membership at events and partner locations.
    </Typography>

    {cardQuery.isLoading ? (
      <DigitalCard card={{} as MembershipCard} loading />
    ) : cardQuery.data?.hasCard && cardQuery.data.card ? (
      <DigitalCard card={cardQuery.data.card} />
    ) : cardQuery.error ? (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">
          {cardQuery.error.message}
        </Typography>
        <Button
          variant="text"
          onClick={() => cardQuery.refetch()}
          sx={{ mt: 1 }}
        >
          Try Again
        </Button>
      </Paper>
    ) : (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          Your digital membership card is being generated. This usually takes a few moments after checkout.
        </Typography>
        <Button
          variant="text"
          onClick={() => cardQuery.refetch()}
          sx={{ mt: 1 }}
        >
          Check Again
        </Button>
      </Paper>
    )}

    {/* Portal button */}
    {canManageSubscription && (
      <Box sx={{ mt: 3 }}>
        <PortalButton
          returnUrl={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/member`}
        />
      </Box>
    )}
  </Box>
) : (
  // ... existing no membership UI
)}
```

### 6. Add MembershipCard Type Import

Ensure the `MembershipCard` schema type is imported (note: different from the component):

```typescript
import type {MembershipCard as MembershipCardSchema} from '@/src/lib/effect/schemas';
```

Then update the useQuery generic type to use `MembershipCardSchema`.

### 7. Validate Implementation

- Run TypeScript compilation: `pnpm tsc --noEmit`
- Run build: `pnpm build`
- Manual testing scenarios listed below

## Testing Strategy

### Manual Testing Scenarios

1. **Existing member with card**: Navigate to `/member`, verify card displays with all data including QR code
2. **New member post-checkout**: Complete checkout, verify card appears after webhook processes and query refetches
3. **Member without card yet**: Verify "being generated" message with "Check Again" button
4. **Error state**: Simulate API error, verify error message displays with "Try Again" button
5. **QR code verification**: Scan QR code with phone camera, verify it decodes to valid JSON payload
6. **Session expired**: Verify graceful handling when session cookie is invalid

### Edge Cases

- Card API returns 401 (session expired) - `SessionError` displayed, no retry
- Card API returns 404 (card not found) - `NotFoundError`, show generating message
- Card API returns 500 - `CardError` displayed with retry button
- Network failure - `CardError` with retry option
- User has membership but card not yet generated by webhook - show generating message

### TanStack Query Behavior

- Verify query is disabled when no membership exists
- Verify refetch on window focus works correctly
- Verify retry logic respects error types

## Acceptance Criteria

- [ ] `src/lib/effect/client-card.ts` created with `getDigitalCard` Effect utility
- [ ] Digital card displays on `/member` route for members with active subscriptions
- [ ] QR code is visible and scannable on the digital card
- [ ] Loading skeleton displays while `cardQuery.isLoading` is true
- [ ] Error state shows error message with "Try Again" button
- [ ] "Card being generated" state shows with "Check Again" button
- [ ] Card query refetches after checkout polling completes
- [ ] TypeScript compilation passes with no errors (`pnpm tsc --noEmit`)
- [ ] Build completes successfully (`pnpm build`)

## Validation Commands

```bash
# Verify TypeScript compilation
pnpm tsc --noEmit

# Build Next.js application
pnpm build

# Start development server for manual testing
pnpm dev
```

Then navigate to `http://localhost:3000/member` while logged in as a member.

## Notes

- **Architecture Consistency**: This implementation follows the Effect-TS + TanStack Query pattern established in `docs/EFFECT_CLIENT_ARCHITECTURE.md`
- **Error Types**: Uses existing tagged errors (`CardError`, `NotFoundError`, `SessionError`) for type-safe error handling
- **Loading State**: Leverages the existing `loading` prop skeleton in `DigitalCard` component
- **Caching**: TanStack Query provides automatic caching with `queryKey: ["digitalCard"]`
- **Refetch Strategy**: Uses `refetchOnWindowFocus: true` for scenarios where user returns from Stripe portal
- **Retry Logic**: Custom retry function prevents retrying on auth/not-found errors
- **Card Generation**: Cards are created by the Stripe webhook in `app/api/webhooks/stripe/route.ts` during checkout completion

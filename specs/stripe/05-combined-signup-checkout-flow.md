# Plan: Combined Signup + Checkout Flow

## Task Description

Refactor the membership signup flow to combine account creation with Stripe checkout into a single user journey. Instead of requiring users to sign up first and then purchase a membership separately, users will create their account as part of the checkout process.

## Objective

When this plan is complete, users will be able to:

1. Visit a "Join Now" page that displays membership plans
2. Select a plan and enter their email/password in one step
3. Have their Firebase Auth account and Firestore document created automatically
4. Be redirected to Stripe checkout with their account already linked
5. After payment, land on their member dashboard with full access

## Problem Statement

The current flow requires two separate steps:

1. Sign up at `/signup` (creates Firebase Auth user + Firestore document)
2. Navigate to membership page and complete Stripe checkout separately

This creates friction and confusion:

- Users may sign up but never complete payment
- The flow feels disconnected
- "Orphan" accounts exist without memberships
- Users don't understand they need to do both steps

## Solution Approach

Create a unified "Join Now" page (`/join`) that:

1. Displays available membership plans fetched from Firestore
2. Collects account credentials (email, password, optional name) alongside plan selection
3. On form submit:
   - Creates Firebase Auth account client-side
   - Calls API to create Firestore user document with user ID
   - Calls checkout API with user ID to create Stripe session
   - Redirects to Stripe checkout
4. After successful Stripe payment, webhook links subscription to user
5. User is redirected to member dashboard

The existing `/signup` page will be repurposed or removed, with login page updated to point to `/join` for new users.

## Relevant Files

Use these files to complete the task:

**Existing files to modify:**

- `src/lib/effect/client-signup.ts` - Contains `createAccount` function to reuse
- `src/lib/effect/schemas.ts` - May need new schema for join request
- `app/api/checkout/route.ts` - Checkout API, may need to ensure userId is passed
- `app/api/auth/signup/route.ts` - Firestore user creation API (recently created)
- `app/login/page.tsx` - Update "Sign up" link to point to `/join`
- `app/about/membership/page.tsx` - Update to link to new join page
- `middleware.ts` - Ensure `/join` route is accessible without auth

**Files to potentially remove/deprecate:**

- `app/signup/page.tsx` - Will be replaced by `/join`
- `src/components/auth/SignupForm.tsx` - Logic moves to JoinForm

### New Files

- `app/join/page.tsx` - New unified join page
- `src/components/membership/JoinForm.tsx` - Combined signup + plan selection form
- `src/components/membership/PlanCard.tsx` - Reusable plan display component
- `src/lib/effect/client-join.ts` - Client-side join flow orchestration

## Implementation Phases

### Phase 1: Foundation

- Create plan display components
- Set up the `/join` route structure
- Create client-side join orchestration module

### Phase 2: Core Implementation

- Build the JoinForm component with validation
- Implement the combined signup + checkout flow
- Handle error states and loading states

### Phase 3: Integration & Polish

- Update navigation links across the site
- Remove deprecated signup page
- Test the complete flow end-to-end
- Handle edge cases (existing email, payment failures, etc.)

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Create PlanCard Component

- Create `src/components/membership/PlanCard.tsx`
- Display plan name, price, benefits list
- Include "Select" button that triggers callback with plan ID
- Style consistently with existing MUI components
- Show visual indicator for selected state

```tsx
interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    price: number;
    benefits: string[];
    stripePriceId: string;
  };
  selected: boolean;
  onSelect: (planId: string, stripePriceId: string) => void;
}
```

### 2. Create Client-Side Join Flow Module

- Create `src/lib/effect/client-join.ts`
- Import `createAccount` from `client-signup.ts`
- Create `joinAndCheckout` Effect that:
  1. Creates Firebase Auth account
  2. Gets ID token
  3. Calls `/api/auth/signup` to create Firestore document
  4. Calls `/api/checkout` with userId, priceId, and URLs
  5. Returns checkout URL for redirect

```tsx
interface JoinRequest {
  email: string;
  password: string;
  name?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export const joinAndCheckout = (
  request: JoinRequest
): Effect.Effect<{ checkoutUrl: string }, AuthError | CheckoutError>
```

### 3. Create JoinForm Component

- Create `src/components/membership/JoinForm.tsx`
- Fetch plans from `/api/membership/plans` using React Query
- Display plans using PlanCard components
- Collect email, password, confirm password, optional name
- Validate form inputs (password match, length, email format)
- On submit, call `joinAndCheckout` and redirect to Stripe
- Handle and display errors appropriately
- Show loading states during async operations

### 4. Create Join Page

- Create `app/join/page.tsx`
- Import and render JoinForm component
- Add page metadata (title, description)
- Style consistently with other pages
- Include link to login for existing members

### 5. Update Checkout API to Support User ID

- Review `app/api/checkout/route.ts`
- Ensure it properly passes `userId` in metadata to Stripe
- Verify the webhook can link the subscription to the correct user
- The existing implementation already supports this via `CheckoutSessionRequest.userId`

### 6. Update Stripe Service for User Linking

- Review `src/lib/effect/stripe.service.ts`
- Ensure checkout session includes userId in both session and subscription metadata
- This allows the webhook to properly link payment to the user
- Current implementation already includes this - verify it works

### 7. Update Navigation Links

- Update `app/login/page.tsx`:
  - Change "Sign up" link from `/signup` to `/join`
  - Update link text to "Join Now" or "Become a Member"
- Update `app/about/membership/page.tsx`:
  - Replace BikeReg link with internal `/join` link
  - Update the call-to-action text
- Update `src/components/navbar.tsx`:
  - Add "Join" link if not already present
  - Consider showing different nav for logged-in vs anonymous users

### 8. Update Middleware for New Route

- Review `middleware.ts`
- Ensure `/join` is accessible without authentication
- Add to public routes list if needed

### 9. Remove Deprecated Signup Flow

- Delete or deprecate `app/signup/page.tsx`
- Delete or deprecate `src/components/auth/SignupForm.tsx`
- Keep `src/lib/effect/client-signup.ts` as it contains reusable `createAccount` function
- Set up redirect from `/signup` to `/join` for any bookmarked links

### 10. Handle Edge Cases

- **Email already exists**: Show clear error message with link to login
- **Checkout abandoned**: User has account but no membership - handle in member dashboard
- **Payment failed**: User lands on cancel URL - show retry option
- Add error boundary around JoinForm for unexpected errors

### 11. Validate Complete Flow

- Test new user signup + checkout flow end-to-end
- Verify Firebase Auth account is created
- Verify Firestore user document is created with correct ID
- Verify Stripe checkout receives userId in metadata
- Verify webhook creates membership linked to correct user
- Verify user lands on member dashboard after successful payment
- Test error scenarios (duplicate email, invalid password, payment failure)

## Testing Strategy

### Manual Testing Checklist

1. **Happy Path**: New user completes full join flow
   - Select plan → Enter credentials → Complete Stripe payment → Land on dashboard
2. **Duplicate Email**: Try to join with existing email
   - Should show error with link to login
3. **Weak Password**: Enter password < 6 characters
   - Should show validation error before submission
4. **Password Mismatch**: Enter different passwords
   - Should show validation error before submission
5. **Abandoned Checkout**: Close Stripe checkout without paying
   - Should land on cancel URL with option to retry
6. **Existing Member Login**: Login and verify dashboard shows membership

### Integration Points to Verify

- Firebase Auth account creation
- Firestore user document creation
- Stripe checkout session with correct metadata
- Stripe webhook processing
- Session cookie creation for post-checkout redirect

## Acceptance Criteria

- [ ] `/join` page displays available membership plans
- [ ] Users can select a plan and enter account credentials in one form
- [ ] Form validates email format, password length, and password match
- [ ] Submitting form creates Firebase Auth account
- [ ] Submitting form creates Firestore user document with matching ID
- [ ] User is redirected to Stripe checkout with their userId in metadata
- [ ] After successful payment, user is redirected to member dashboard
- [ ] Member dashboard shows the user's active membership
- [ ] Duplicate email shows clear error with login link
- [ ] Navigation throughout site points to `/join` for new users
- [ ] `/signup` redirects to `/join`

## Validation Commands

Execute these commands to validate the task is complete:

- `pnpm build` - Ensure the application builds without errors
- `pnpm tsc --noEmit` - Verify TypeScript types are correct
- Manual test: Complete the full join flow with a test email
- Check Firestore: Verify user document exists with correct structure
- Check Firebase Auth: Verify auth account exists with same UID
- Check Stripe Dashboard: Verify subscription has userId in metadata

## Notes

### Environment Variables Required

No new environment variables needed. Existing variables used:

- `STRIPE_PRICE_INDIVIDUAL` - Individual plan price ID
- `STRIPE_PRICE_FAMILY` - Family plan price ID
- `NEXT_PUBLIC_SITE_URL` - For success/cancel URLs

### Stripe Checkout Configuration

The success URL should include the session ID for verification:

```
successUrl: `${siteUrl}/member?session_id={CHECKOUT_SESSION_ID}`
```

### Error Recovery

If a user creates an account but doesn't complete payment:

- They can log in and will see "No Active Membership" on dashboard
- Dashboard provides link to purchase membership
- Their existing account will be used for checkout (no duplicate)

### Future Enhancements (Out of Scope)

- Email verification before checkout
- Promo code support in join flow
- Family member management during signup

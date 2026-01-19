# Plan: Admin Stripe-Firebase Reconciliation Tool

## Task Description

Create an admin dashboard feature that allows manual validation of Stripe subscription data against Firebase membership data, with the ability to automatically reconcile discrepancies. This addresses the support scenario where a customer claims they paid but doesn't have access to their member dashboard.

## Objective

Provide admins with a one-click tool to:

1. Search for a customer by email or Stripe customer ID
2. Compare their Stripe subscription status with Firebase membership data
3. Display discrepancies between the two systems
4. Automatically sync Firebase to match Stripe's authoritative payment data
5. **Update or create both the membership document AND the membership card document**

## Problem Statement

When webhook events fail or are processed out of order, a customer may have an active Stripe subscription but their Firebase membership data may be missing, incorrect, or stale. Currently, there's no admin tool to diagnose and fix these discrepancies, requiring manual database edits.

## Solution Approach

Build a reconciliation service that:

1. Fetches the customer's subscription data directly from Stripe API
2. Compares it with their Firebase membership document AND card document
3. Identifies specific discrepancies (status mismatch, missing membership, missing card, date mismatches)
4. Allows one-click sync that updates Firebase to match Stripe's authoritative data
5. Creates/updates both membership and card documents as needed
6. Creates audit logs for all reconciliation actions

## Data Model Context

Each member has TWO documents that must be kept in sync:

```
users/{userId}/
├── memberships/{stripeSubscriptionId}   <-- Membership document
│   ├── stripeSubscriptionId: string
│   ├── planType: 'individual' | 'family'
│   ├── status: MembershipStatus
│   ├── startDate: Timestamp
│   ├── endDate: Timestamp
│   ├── autoRenew: boolean
│   └── timestamps...
│
└── cards/current                         <-- Card document
    ├── membershipNumber: string          # Format: DEC-2025-000001
    ├── memberName: string
    ├── email: string
    ├── planType: 'individual' | 'family'
    ├── status: MembershipStatus
    ├── validFrom: ISO string
    ├── validUntil: ISO string
    ├── qrCodeData: string                # Encoded QR payload
    └── timestamps...
```

Both documents must be updated during reconciliation to ensure the member can access their dashboard AND use their digital membership card.

## Relevant Files

Use these files to complete the task:

### Existing Files to Modify

- `src/lib/effect/stripe.service.ts:1-252` - Add methods to fetch customer by email and list subscriptions
- `src/lib/effect/firestore.service.ts:1-665` - Add methods for membership/card upsert during reconciliation
- `src/lib/effect/card.service.ts:1-194` - Add method to update existing card (not just create)
- `src/lib/effect/admin.service.ts` - Add reconciliation business logic
- `src/lib/effect/errors.ts` - Add reconciliation-specific error types if needed
- `src/lib/effect/schemas.ts:1-297` - Add reconciliation-related schemas
- `src/lib/effect/layers.ts` - Wire up any new service dependencies
- `src/components/admin/MembershipManagement.tsx` - Add reconciliation UI
- `app/dashboard/page.tsx` - Integrate reconciliation component

### New Files to Create

- `app/api/admin/reconcile/route.ts` - API endpoint for reconciliation operations
- `src/components/admin/ReconciliationTool.tsx` - Reconciliation UI component

## Implementation Phases

### Phase 1: Foundation

Extend Stripe and Firestore services with the primitives needed for comparison:

- Stripe: Fetch customer by email, list customer subscriptions
- Firestore: Query membership by stripeCustomerId or email

### Phase 2: Core Implementation

Build the reconciliation service logic:

- Compare Stripe vs Firebase data structures (membership AND card)
- Generate discrepancy reports covering both documents
- Execute sync operations for both membership and card with audit logging

### Phase 3: Integration & Polish

Wire up the admin UI:

- Search form with email input
- Comparison view showing Stripe vs Firebase data (including card status)
- Reconcile button with confirmation
- Success/error feedback

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Extend Stripe Service with Customer Lookup

Add to `src/lib/effect/stripe.service.ts`:

- Add `getCustomerByEmail` method to search Stripe customers by email
- Add `listCustomerSubscriptions` method to fetch all subscriptions for a customer

```typescript
// Add to StripeService interface (around line 9)
readonly getCustomerByEmail: (email: string) => Effect.Effect<Stripe.Customer | null, StripeError>;

readonly listCustomerSubscriptions: (
  customerId: string,
) => Effect.Effect<Stripe.Subscription[], StripeError>;

// Implementation (add after line 246)
getCustomerByEmail: (email) =>
  Effect.tryPromise({
    try: async () => {
      const {stripe} = getClient();
      const customers = await stripe.customers.list({email, limit: 1});
      return customers.data[0] || null;
    },
    catch: (error) =>
      new StripeError({
        code: 'CUSTOMER_SEARCH_FAILED',
        message: `Failed to search for customer by email ${email}`,
        cause: error,
      }),
  }),

listCustomerSubscriptions: (customerId) =>
  Effect.tryPromise({
    try: async () => {
      const {stripe} = getClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        expand: ['data.items.data.price'],
      });
      return subscriptions.data;
    },
    catch: (error) =>
      new StripeError({
        code: 'SUBSCRIPTIONS_LIST_FAILED',
        message: `Failed to list subscriptions for customer ${customerId}`,
        cause: error,
      }),
  }),
```

### 2. Extend Card Service with Update Method

Add to `src/lib/effect/card.service.ts`:

- Add `updateCard` method to update existing card without regenerating membership number

```typescript
// Add to MembershipCardService interface (around line 9)
readonly updateCard: (params: {
  userId: string;
  user: UserDocument;
  membership: MembershipDocument;
}) => Effect.Effect<MembershipCard, CardError | FirestoreError | QRError>;

// Implementation (add after createCard, around line 82)
updateCard: ({userId, user, membership}) =>
  Effect.gen(function* () {
    // Get existing card to preserve membership number
    const existingCard = yield* firestore.getMembershipCard(userId);

    if (!existingCard) {
      // No existing card - create new one
      return yield* MembershipCardService.of({...}).createCard({userId, user, membership});
    }

    // Calculate validity dates from membership
    const validFrom =
      membership.startDate.toDate?.()?.toISOString() ||
      new Date(membership.startDate as unknown as number).toISOString();
    const validUntil =
      membership.endDate.toDate?.() || new Date(membership.endDate as unknown as number);

    // Regenerate QR code with updated dates
    const qrData = yield* qr.generateQRData({
      membershipNumber: existingCard.membershipNumber,
      userId,
      validUntil,
    });

    // Update card document preserving membership number
    const updatedCard: Omit<MembershipCard, 'id'> = {
      userId,
      membershipNumber: existingCard.membershipNumber, // Keep existing number
      memberName: user.name || user.email,
      email: user.email,
      planType: membership.planType,
      status: membership.status,
      validFrom,
      validUntil: validUntil.toISOString(),
      qrCodeData: qrData,
      pdfUrl: null,
      createdAt: existingCard.createdAt,
      updatedAt: new Date().toISOString(),
    };

    yield* firestore.setMembershipCard(userId, updatedCard);
    yield* Effect.log(`Membership card updated for user ${userId}`);

    return {...updatedCard, id: 'current'} as MembershipCard;
  }),
```

### 3. Add Firestore Service Method for Updating Membership Card

Add to `src/lib/effect/firestore.service.ts`:

- Add `updateMembershipCard` method for partial updates to card document

```typescript
// Add to FirestoreService interface (around line 78)
readonly updateMembershipCard: (
  userId: string,
  data: Partial<MembershipCard>,
) => Effect.Effect<void, FirestoreError>;

// Implementation (add after setMembershipCard, around line 490)
updateMembershipCard: (userId, data) =>
  Effect.tryPromise({
    try: () =>
      db
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection('cards')
        .doc('current')
        .update({
          ...data,
          updatedAt: FieldValue.serverTimestamp(),
        }),
    catch: (error) =>
      new FirestoreError({
        code: 'UPDATE_CARD_FAILED',
        message: `Failed to update membership card for user ${userId}`,
        cause: error,
      }),
  }),
```

### 4. Create Reconciliation Types and Schemas

Add to `src/lib/effect/schemas.ts`:

```typescript
// Add after ExportOptions (around line 297)

// Discrepancy types for reconciliation
export const DiscrepancyType = S.Literal(
  'NO_STRIPE_CUSTOMER', // No Stripe customer found for email
  'NO_STRIPE_SUBSCRIPTION', // Customer has no active subscription
  'MISSING_FIREBASE_USER', // User not in Firebase
  'MISSING_FIREBASE_MEMBERSHIP', // Membership document missing
  'MISSING_FIREBASE_CARD', // Card document missing
  'STATUS_MISMATCH', // Status differs between Stripe and Firebase
  'DATE_MISMATCH', // Start/end dates differ
  'PLAN_MISMATCH', // Plan type differs
  'CARD_STATUS_MISMATCH', // Card status doesn't match membership
  'CARD_DATES_MISMATCH', // Card dates don't match membership
  'NO_DISCREPANCY', // Everything matches
);
export type DiscrepancyType = S.Schema.Type<typeof DiscrepancyType>;

// Stripe data snapshot for comparison
export const StripeDataSnapshot = S.Struct({
  customerId: S.String,
  customerEmail: S.String,
  subscriptionId: S.String,
  subscriptionStatus: S.String,
  priceId: S.String,
  planType: PlanType,
  currentPeriodStart: S.String, // ISO date
  currentPeriodEnd: S.String, // ISO date
  cancelAtPeriodEnd: S.Boolean,
});
export type StripeDataSnapshot = S.Schema.Type<typeof StripeDataSnapshot>;

// Firebase data snapshot for comparison
export const FirebaseDataSnapshot = S.Struct({
  userId: S.String,
  userEmail: S.String,
  membership: S.NullOr(
    S.Struct({
      id: S.String,
      stripeSubscriptionId: S.String,
      status: MembershipStatus,
      planType: PlanType,
      startDate: S.String, // ISO date
      endDate: S.String, // ISO date
      autoRenew: S.Boolean,
    }),
  ),
  card: S.NullOr(
    S.Struct({
      membershipNumber: S.String,
      status: MembershipStatus,
      planType: PlanType,
      validFrom: S.String,
      validUntil: S.String,
    }),
  ),
});
export type FirebaseDataSnapshot = S.Schema.Type<typeof FirebaseDataSnapshot>;

// Reconciliation report
export const ReconciliationReport = S.Struct({
  email: S.String,
  stripeData: S.NullOr(StripeDataSnapshot),
  firebaseData: S.NullOr(FirebaseDataSnapshot),
  discrepancies: S.Array(DiscrepancyType),
  canReconcile: S.Boolean,
  reconcileActions: S.Array(S.String), // Human-readable list of actions to take
});
export type ReconciliationReport = S.Schema.Type<typeof ReconciliationReport>;

// Reconciliation result
export const ReconciliationResult = S.Struct({
  success: S.Boolean,
  email: S.String,
  actionsPerformed: S.Array(S.String),
  membershipUpdated: S.Boolean,
  cardUpdated: S.Boolean,
  cardCreated: S.Boolean,
  userCreated: S.Boolean,
  error: S.optional(S.String),
});
export type ReconciliationResult = S.Schema.Type<typeof ReconciliationResult>;
```

### 5. Create Reconciliation Logic in Admin Service

Add to `src/lib/effect/admin.service.ts`:

```typescript
// Add to AdminService interface
readonly validateStripeVsFirebase: (
  email: string,
) => Effect.Effect<ReconciliationReport, AdminError | StripeError | FirestoreError>;

readonly reconcileMembership: (
  email: string,
) => Effect.Effect<ReconciliationResult, AdminError | StripeError | FirestoreError | CardError | QRError>;

// Implementation
validateStripeVsFirebase: (email) =>
  Effect.gen(function* () {
    const stripe = yield* StripeService;
    const firestore = yield* FirestoreService;

    // Fetch Stripe data
    const stripeCustomer = yield* stripe.getCustomerByEmail(email);
    let stripeData: StripeDataSnapshot | null = null;

    if (stripeCustomer) {
      const subscriptions = yield* stripe.listCustomerSubscriptions(stripeCustomer.id);
      // Find the most recent active or past_due subscription
      const activeSubscription = subscriptions.find(
        (sub) => sub.status === 'active' || sub.status === 'past_due'
      ) || subscriptions[0]; // Fall back to most recent

      if (activeSubscription) {
        const priceId = activeSubscription.items.data[0]?.price.id || '';
        stripeData = {
          customerId: stripeCustomer.id,
          customerEmail: stripeCustomer.email || email,
          subscriptionId: activeSubscription.id,
          subscriptionStatus: activeSubscription.status,
          priceId,
          planType: resolvePlanType(priceId),
          currentPeriodStart: new Date(activeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        };
      }
    }

    // Fetch Firebase data
    const firebaseUser = yield* firestore.getUserByEmail(email);
    let firebaseData: FirebaseDataSnapshot | null = null;

    if (firebaseUser) {
      const membership = yield* firestore.getActiveMembership(firebaseUser.id);
      const card = yield* firestore.getMembershipCard(firebaseUser.id);

      firebaseData = {
        userId: firebaseUser.id,
        userEmail: firebaseUser.email,
        membership: membership ? {
          id: membership.id,
          stripeSubscriptionId: membership.stripeSubscriptionId,
          status: membership.status,
          planType: membership.planType,
          startDate: formatTimestamp(membership.startDate),
          endDate: formatTimestamp(membership.endDate),
          autoRenew: membership.autoRenew,
        } : null,
        card: card ? {
          membershipNumber: card.membershipNumber,
          status: card.status,
          planType: card.planType,
          validFrom: card.validFrom,
          validUntil: card.validUntil,
        } : null,
      };
    }

    // Detect discrepancies
    const discrepancies = detectDiscrepancies(stripeData, firebaseData);
    const reconcileActions = generateReconcileActions(discrepancies, stripeData, firebaseData);

    return {
      email,
      stripeData,
      firebaseData,
      discrepancies,
      canReconcile: stripeData !== null && discrepancies.length > 0 && !discrepancies.includes('NO_STRIPE_SUBSCRIPTION'),
      reconcileActions,
    };
  }),

reconcileMembership: (email) =>
  Effect.gen(function* () {
    const firestore = yield* FirestoreService;
    const cardService = yield* MembershipCardService;

    // First validate to get current state
    const report = yield* validateStripeVsFirebase(email);

    if (!report.canReconcile || !report.stripeData) {
      return {
        success: false,
        email,
        actionsPerformed: [],
        membershipUpdated: false,
        cardUpdated: false,
        cardCreated: false,
        userCreated: false,
        error: 'Cannot reconcile: No active Stripe subscription found',
      };
    }

    const actionsPerformed: string[] = [];
    let userCreated = false;
    let membershipUpdated = false;
    let cardUpdated = false;
    let cardCreated = false;

    const stripeData = report.stripeData;

    // Step 1: Ensure user exists
    let userId: string;
    if (!report.firebaseData) {
      // Create user
      const newUser = yield* firestore.upsertUserByStripeCustomer(
        stripeData.customerId,
        stripeData.customerEmail,
        {}
      );
      userId = newUser.id;
      userCreated = true;
      actionsPerformed.push(`Created Firebase user: ${userId}`);
    } else {
      userId = report.firebaseData.userId;
    }

    // Step 2: Create or update membership document
    const membershipData = {
      stripeSubscriptionId: stripeData.subscriptionId,
      planType: stripeData.planType,
      status: stripeData.subscriptionStatus as MembershipStatus,
      startDate: new Date(stripeData.currentPeriodStart),
      endDate: new Date(stripeData.currentPeriodEnd),
      autoRenew: !stripeData.cancelAtPeriodEnd,
    };

    if (!report.firebaseData?.membership) {
      yield* firestore.setMembership(userId, stripeData.subscriptionId, membershipData);
      actionsPerformed.push(`Created membership: ${stripeData.subscriptionId}`);
    } else {
      yield* firestore.updateMembership(userId, stripeData.subscriptionId, membershipData);
      actionsPerformed.push(`Updated membership: ${stripeData.subscriptionId}`);
    }
    membershipUpdated = true;

    // Step 3: Create or update card document
    const user = yield* firestore.getUser(userId);
    const membership = yield* firestore.getMembership(userId, stripeData.subscriptionId);

    if (user && membership) {
      if (!report.firebaseData?.card) {
        // Create new card
        yield* cardService.createCard({userId, user, membership});
        cardCreated = true;
        actionsPerformed.push('Created membership card with new number');
      } else {
        // Update existing card
        yield* cardService.updateCard({userId, user, membership});
        cardUpdated = true;
        actionsPerformed.push('Updated membership card (preserved number)');
      }
    }

    // Step 4: Log audit entry
    yield* firestore.logAuditEntry(userId, 'RECONCILIATION', {
      stripeSubscriptionId: stripeData.subscriptionId,
      discrepanciesFixed: report.discrepancies,
      actionsPerformed,
      performedBy: 'admin', // TODO: Pass admin user ID
    });

    return {
      success: true,
      email,
      actionsPerformed,
      membershipUpdated,
      cardUpdated,
      cardCreated,
      userCreated,
    };
  }),
```

### 6. Create API Route for Reconciliation

Create `app/api/admin/reconcile/route.ts`:

```typescript
import {Effect} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {AdminService} from '@/src/lib/effect/admin.service';
import {LiveLayer} from '@/src/lib/effect/layers';

// GET: Validate Stripe vs Firebase for given email
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({error: 'Email parameter required'}, {status: 400});
  }

  const program = Effect.gen(function* () {
    const adminService = yield* AdminService;
    return yield* adminService.validateStripeVsFirebase(email);
  }).pipe(
    Effect.catchAll((error) => {
      console.error('Reconciliation validation error:', error);
      return Effect.succeed({error: error.message || 'Validation failed'});
    }),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ('error' in result) {
    return NextResponse.json({error: result.error}, {status: 500});
  }

  return NextResponse.json(result);
}

// POST: Execute reconciliation for given email
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {email} = body;

  if (!email) {
    return NextResponse.json({error: 'Email required'}, {status: 400});
  }

  const program = Effect.gen(function* () {
    const adminService = yield* AdminService;
    return yield* adminService.reconcileMembership(email);
  }).pipe(
    Effect.catchAll((error) => {
      console.error('Reconciliation execution error:', error);
      return Effect.succeed({
        success: false,
        error: error.message || 'Reconciliation failed',
      });
    }),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if (!result.success) {
    return NextResponse.json(result, {status: 500});
  }

  return NextResponse.json(result);
}
```

### 7. Create ReconciliationTool Component

Create `src/components/admin/ReconciliationTool.tsx`:

```typescript
'use client';

import {Alert, AlertTitle, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack, TextField, Typography} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

interface ReconciliationReport {
  email: string;
  stripeData: {
    customerId: string;
    subscriptionId: string;
    subscriptionStatus: string;
    planType: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  firebaseData: {
    userId: string;
    membership: {
      id: string;
      status: string;
      planType: string;
      startDate: string;
      endDate: string;
    } | null;
    card: {
      membershipNumber: string;
      status: string;
      validUntil: string;
    } | null;
  } | null;
  discrepancies: string[];
  canReconcile: boolean;
  reconcileActions: string[];
}

interface ReconciliationResult {
  success: boolean;
  actionsPerformed: string[];
  error?: string;
}

export function ReconciliationTool() {
  const [email, setEmail] = useState('');
  const [report, setReport] = useState<ReconciliationReport | null>(null);

  const validateMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/admin/reconcile?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Validation failed');
      return response.json() as Promise<ReconciliationReport>;
    },
    onSuccess: setReport,
  });

  const reconcileMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/admin/reconcile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email}),
      });
      if (!response.ok) throw new Error('Reconciliation failed');
      return response.json() as Promise<ReconciliationResult>;
    },
    onSuccess: () => {
      // Re-validate to show updated state
      validateMutation.mutate(email);
    },
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Stripe/Firebase Reconciliation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
          Validate and sync membership data between Stripe and Firebase
        </Typography>

        <Stack direction="row" spacing={2} sx={{mb: 3}}>
          <TextField
            label="Member Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            onClick={() => validateMutation.mutate(email)}
            disabled={!email || validateMutation.isPending}
          >
            {validateMutation.isPending ? <CircularProgress size={20} /> : 'Validate'}
          </Button>
        </Stack>

        {report && (
          <>
            <Divider sx={{my: 2}} />

            {/* Discrepancies */}
            {report.discrepancies.length > 0 && report.discrepancies[0] !== 'NO_DISCREPANCY' ? (
              <Alert severity="warning" sx={{mb: 2}}>
                <AlertTitle>Discrepancies Found</AlertTitle>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {report.discrepancies.map((d) => (
                    <Chip key={d} label={d.replace(/_/g, ' ')} size="small" color="warning" />
                  ))}
                </Stack>
              </Alert>
            ) : (
              <Alert severity="success" sx={{mb: 2}}>
                No discrepancies - data is in sync
              </Alert>
            )}

            {/* Comparison Table */}
            <Stack direction="row" spacing={2} sx={{mb: 2}}>
              {/* Stripe Data */}
              <Box flex={1}>
                <Typography variant="subtitle2" color="primary">Stripe Data</Typography>
                {report.stripeData ? (
                  <Box sx={{fontSize: '0.875rem'}}>
                    <div>Customer: {report.stripeData.customerId}</div>
                    <div>Subscription: {report.stripeData.subscriptionId}</div>
                    <div>Status: <strong>{report.stripeData.subscriptionStatus}</strong></div>
                    <div>Plan: {report.stripeData.planType}</div>
                    <div>Period End: {new Date(report.stripeData.currentPeriodEnd).toLocaleDateString()}</div>
                  </Box>
                ) : (
                  <Typography color="error">No Stripe subscription found</Typography>
                )}
              </Box>

              {/* Firebase Data */}
              <Box flex={1}>
                <Typography variant="subtitle2" color="secondary">Firebase Data</Typography>
                {report.firebaseData ? (
                  <Box sx={{fontSize: '0.875rem'}}>
                    <div>User ID: {report.firebaseData.userId}</div>
                    {report.firebaseData.membership ? (
                      <>
                        <div>Status: <strong>{report.firebaseData.membership.status}</strong></div>
                        <div>Plan: {report.firebaseData.membership.planType}</div>
                        <div>End Date: {new Date(report.firebaseData.membership.endDate).toLocaleDateString()}</div>
                      </>
                    ) : (
                      <Typography color="error">No membership document</Typography>
                    )}
                    {report.firebaseData.card ? (
                      <div>Card: {report.firebaseData.card.membershipNumber}</div>
                    ) : (
                      <Typography color="error">No card document</Typography>
                    )}
                  </Box>
                ) : (
                  <Typography color="error">No Firebase user found</Typography>
                )}
              </Box>
            </Stack>

            {/* Actions Preview */}
            {report.reconcileActions.length > 0 && (
              <Alert severity="info" sx={{mb: 2}}>
                <AlertTitle>Reconcile Actions</AlertTitle>
                <ul style={{margin: 0, paddingLeft: 20}}>
                  {report.reconcileActions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Reconcile Button */}
            {report.canReconcile && (
              <Button
                variant="contained"
                color="warning"
                onClick={() => reconcileMutation.mutate(email)}
                disabled={reconcileMutation.isPending}
                fullWidth
              >
                {reconcileMutation.isPending ? (
                  <CircularProgress size={20} />
                ) : (
                  'Reconcile Now'
                )}
              </Button>
            )}

            {/* Result */}
            {reconcileMutation.isSuccess && (
              <Alert severity="success" sx={{mt: 2}}>
                <AlertTitle>Reconciliation Complete</AlertTitle>
                <ul style={{margin: 0, paddingLeft: 20}}>
                  {reconcileMutation.data.actionsPerformed.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {reconcileMutation.isError && (
              <Alert severity="error" sx={{mt: 2}}>
                Reconciliation failed: {reconcileMutation.error.message}
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### 8. Integrate into Admin Dashboard

Add to `app/dashboard/page.tsx`:

```typescript
// Import the component
import {ReconciliationTool} from '@/src/components/admin/ReconciliationTool';

// Add to the dashboard layout (in a suitable section/tab)
<ReconciliationTool />
```

### 9. Add Helper Functions for Discrepancy Detection

Add helper functions to admin service or a separate utility file:

```typescript
function detectDiscrepancies(
  stripeData: StripeDataSnapshot | null,
  firebaseData: FirebaseDataSnapshot | null,
): DiscrepancyType[] {
  const discrepancies: DiscrepancyType[] = [];

  // No Stripe data
  if (!stripeData) {
    discrepancies.push('NO_STRIPE_CUSTOMER');
    return discrepancies;
  }

  // No Firebase user
  if (!firebaseData) {
    discrepancies.push('MISSING_FIREBASE_USER');
    discrepancies.push('MISSING_FIREBASE_MEMBERSHIP');
    discrepancies.push('MISSING_FIREBASE_CARD');
    return discrepancies;
  }

  // Missing membership
  if (!firebaseData.membership) {
    discrepancies.push('MISSING_FIREBASE_MEMBERSHIP');
  } else {
    // Status mismatch
    if (firebaseData.membership.status !== stripeData.subscriptionStatus) {
      discrepancies.push('STATUS_MISMATCH');
    }

    // Plan mismatch
    if (firebaseData.membership.planType !== stripeData.planType) {
      discrepancies.push('PLAN_MISMATCH');
    }

    // Date mismatch (compare dates, allow 1 day tolerance)
    const stripeEnd = new Date(stripeData.currentPeriodEnd).getTime();
    const firebaseEnd = new Date(firebaseData.membership.endDate).getTime();
    if (Math.abs(stripeEnd - firebaseEnd) > 86400000) {
      // 1 day in ms
      discrepancies.push('DATE_MISMATCH');
    }
  }

  // Missing card
  if (!firebaseData.card) {
    discrepancies.push('MISSING_FIREBASE_CARD');
  } else if (firebaseData.membership) {
    // Card/membership mismatches
    if (firebaseData.card.status !== firebaseData.membership.status) {
      discrepancies.push('CARD_STATUS_MISMATCH');
    }
    if (firebaseData.card.planType !== firebaseData.membership.planType) {
      discrepancies.push('CARD_STATUS_MISMATCH');
    }
  }

  if (discrepancies.length === 0) {
    discrepancies.push('NO_DISCREPANCY');
  }

  return discrepancies;
}

function generateReconcileActions(
  discrepancies: DiscrepancyType[],
  stripeData: StripeDataSnapshot | null,
  firebaseData: FirebaseDataSnapshot | null,
): string[] {
  const actions: string[] = [];

  if (!stripeData) {
    return ['No action possible - no Stripe subscription found'];
  }

  if (discrepancies.includes('MISSING_FIREBASE_USER')) {
    actions.push('Create Firebase user linked to Stripe customer');
  }

  if (discrepancies.includes('MISSING_FIREBASE_MEMBERSHIP')) {
    actions.push(`Create membership document with status: ${stripeData.subscriptionStatus}`);
  }

  if (discrepancies.includes('STATUS_MISMATCH')) {
    actions.push(
      `Update membership status: ${firebaseData?.membership?.status} → ${stripeData.subscriptionStatus}`,
    );
  }

  if (discrepancies.includes('DATE_MISMATCH')) {
    actions.push(
      `Update membership end date to: ${new Date(stripeData.currentPeriodEnd).toLocaleDateString()}`,
    );
  }

  if (discrepancies.includes('PLAN_MISMATCH')) {
    actions.push(
      `Update membership plan type: ${firebaseData?.membership?.planType} → ${stripeData.planType}`,
    );
  }

  if (discrepancies.includes('MISSING_FIREBASE_CARD')) {
    actions.push('Generate new membership card with QR code');
  }

  if (
    discrepancies.includes('CARD_STATUS_MISMATCH') ||
    discrepancies.includes('CARD_DATES_MISMATCH')
  ) {
    actions.push('Update card to match membership (preserve membership number)');
  }

  return actions;
}

function resolvePlanType(priceId: string): 'individual' | 'family' {
  if (priceId === process.env.STRIPE_PRICE_FAMILY) {
    return 'family';
  }
  return 'individual';
}

function formatTimestamp(timestamp: any): string {
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date(timestamp).toISOString();
}
```

### 10. Validate Implementation

- Run type check: `pnpm tsc`
- Run linter: `pnpm lint`
- Run tests: `pnpm test`
- Build: `pnpm build`
- Manual testing:
  - Search for email with matching data (no discrepancies)
  - Search for email with no Stripe subscription
  - Search for email with Stripe sub but no Firebase membership
  - Search for email with membership but no card
  - Execute reconciliation and verify BOTH membership AND card are updated

## Testing Strategy

### Unit Tests

- Test `validateStripeVsFirebase` with mocked Stripe and Firestore responses
- Test `detectDiscrepancies` with various mismatch scenarios:
  - Missing user, membership, card
  - Status/date/plan mismatches
  - Card out of sync with membership
- Test `reconcileMembership` creates/updates correct documents

### Integration Tests

- Test API routes with authenticated admin requests
- Test API routes reject non-admin requests
- Test reconciliation flow end-to-end with test Stripe data
- Verify card is created when missing
- Verify card is updated (preserving membership number) when membership changes

### Manual Testing Scenarios

1. **Happy Path**: User exists in both systems with matching data → "No discrepancies found"
2. **Missing Firebase User**: Stripe customer exists, no Firebase user → Create user, membership, AND card
3. **Missing Membership**: Firebase user exists, no membership doc → Create membership AND card
4. **Missing Card Only**: User and membership exist, no card → Create card with new membership number
5. **Status Mismatch**: Firebase says 'canceled', Stripe says 'active' → Update membership AND card status
6. **No Stripe Subscription**: Email has no Stripe subscription → "No active subscription found"

## Acceptance Criteria

- [ ] Admin can search by email to compare Stripe vs Firebase data
- [ ] Discrepancies are clearly displayed with specific mismatch types
- [ ] Report shows status of BOTH membership document AND card document
- [ ] One-click reconciliation updates Firebase to match Stripe
- [ ] Reconciliation creates missing user document if needed
- [ ] Reconciliation creates missing membership document if needed
- [ ] Reconciliation creates missing card document (with new membership number) if needed
- [ ] Reconciliation updates existing card (preserving membership number) if membership changed
- [ ] Audit log entries created for all reconciliation actions
- [ ] Non-admins cannot access reconciliation endpoints
- [ ] All TypeScript types are properly defined
- [ ] UI shows loading states during async operations
- [ ] Error messages are user-friendly and actionable

## Validation Commands

Execute these commands to validate the task is complete:

- `pnpm tsc` - Verify no TypeScript errors
- `pnpm lint` - Verify no linting issues
- `pnpm test` - Verify all tests pass
- `pnpm build` - Verify production build succeeds

## Notes

### Stripe as Source of Truth

Stripe is the authoritative source for payment data. The reconciliation flow should always sync Firebase TO Stripe, never the other way around. If Stripe says a subscription is active, Firebase should reflect that.

### Plan Type Detection

Stripe subscriptions store the price ID, which maps to plan type:

- `STRIPE_PRICE_INDIVIDUAL` → 'individual'
- `STRIPE_PRICE_FAMILY` → 'family'

The reconciliation service needs to resolve price IDs to plan types using environment variables.

### Card Handling Rules

1. **Missing card**: Generate new card with new membership number (uses atomic counter)
2. **Existing card, membership updated**: Update card preserving the existing membership number
3. **Card status/dates out of sync**: Update card to match membership document

This ensures members keep their same membership number even after reconciliation.

### Idempotency

The reconciliation operation should be idempotent - running it multiple times with the same data should produce the same result without creating duplicate records.

### Rate Limiting Consideration

Stripe API has rate limits. If bulk reconciliation is needed in the future, implement batching with delays. For now, single-email reconciliation should be fine.

### Effect-TS Patterns

Follow existing codebase patterns:

- Use `Effect.gen(function* () { ... })` for multi-step operations
- Use typed errors with `_tag` for granular error handling
- Use `Effect.runPromise` in API routes and React Query mutations

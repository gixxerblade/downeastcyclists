import {Schema as S} from '@effect/schema';

// Membership status enum - matches Stripe subscription statuses
// Note: "trialing" is kept for Stripe API compatibility but DEC doesn't offer trials
export const MembershipStatus = S.Literal(
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing', // Kept for Stripe compatibility, not used by DEC
  'unpaid',
);
export type MembershipStatus = S.Schema.Type<typeof MembershipStatus>;

// Plan type enum
export const PlanType = S.Literal('individual', 'family');
export type PlanType = S.Schema.Type<typeof PlanType>;

// Address schema
export const Address = S.Struct({
  street: S.optional(S.String),
  city: S.optional(S.String),
  state: S.optional(S.String),
  zip: S.optional(S.String),
});

// User document schema
export const UserDocument = S.Struct({
  id: S.String,
  email: S.String,
  name: S.optional(S.String),
  phone: S.optional(S.String),
  address: S.optional(Address),
  stripeCustomerId: S.optional(S.String),
  createdAt: S.Any, // Firestore Timestamp
  updatedAt: S.Any, // Firestore Timestamp
});
export type UserDocument = S.Schema.Type<typeof UserDocument>;

// Membership document schema
export const MembershipDocument = S.Struct({
  id: S.String,
  stripeSubscriptionId: S.String,
  planType: PlanType,
  status: MembershipStatus,
  startDate: S.Any, // Firestore Timestamp
  endDate: S.Any, // Firestore Timestamp
  autoRenew: S.Boolean,
  createdAt: S.Any,
  updatedAt: S.Any,
});
export type MembershipDocument = S.Schema.Type<typeof MembershipDocument>;

// Membership plan schema
export const MembershipPlanDocument = S.Struct({
  id: S.String,
  name: S.String,
  description: S.String,
  stripePriceId: S.String,
  price: S.Number,
  interval: S.Literal('year', 'month'),
  benefits: S.Array(S.String),
  isActive: S.Boolean,
  sortOrder: S.Number,
});
export type MembershipPlanDocument = S.Schema.Type<typeof MembershipPlanDocument>;

// API Request schemas
export const CheckoutSessionRequest = S.Struct({
  priceId: S.String,
  userId: S.optional(S.String),
  email: S.optional(S.String),
  successUrl: S.String,
  cancelUrl: S.String,
  coverFees: S.optional(S.Boolean),
  planPrice: S.optional(S.Number),
});
export type CheckoutSessionRequest = S.Schema.Type<typeof CheckoutSessionRequest>;

// API Response schemas
export const CheckoutSessionResponse = S.Struct({
  sessionId: S.String,
  url: S.String,
});
export type CheckoutSessionResponse = S.Schema.Type<typeof CheckoutSessionResponse>;

export const MembershipStatusResponse = S.Struct({
  userId: S.String,
  email: S.String,
  isActive: S.Boolean,
  membership: S.NullOr(
    S.Struct({
      planType: PlanType,
      planName: S.String,
      status: MembershipStatus,
      endDate: S.String, // ISO date string
      autoRenew: S.Boolean,
    }),
  ),
});
export type MembershipStatusResponse = S.Schema.Type<typeof MembershipStatusResponse>;

// Stripe webhook payload schemas
export const StripeWebhookEvent = S.Struct({
  id: S.String,
  type: S.String,
  data: S.Struct({
    object: S.Any, // Stripe object varies by event type
  }),
});
export type StripeWebhookEvent = S.Schema.Type<typeof StripeWebhookEvent>;

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

// Join form validation schema
export const JoinFormData = S.Struct({
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => 'Please enter a valid email address',
    }),
  ),
  password: S.String.pipe(
    S.minLength(6, {
      message: () => 'Password must be at least 6 characters',
    }),
  ),
  confirmPassword: S.String,
  name: S.optional(S.String),
  selectedPlanId: S.String.pipe(
    S.minLength(1, {
      message: () => 'Please select a membership plan',
    }),
  ),
  selectedPriceId: S.String.pipe(
    S.minLength(1, {
      message: () => 'Invalid plan selected',
    }),
  ),
});
export type JoinFormData = S.Schema.Type<typeof JoinFormData>;

// Webhook event tracking for idempotency
export const WebhookEventDocument = S.Struct({
  id: S.String, // Stripe event ID (evt_xxx)
  type: S.String, // Event type (checkout.session.completed, etc.)
  processedAt: S.Any, // Firestore Timestamp
  status: S.Literal('processing', 'completed', 'failed'),
  errorMessage: S.optional(S.String),
  retryCount: S.optional(S.Number),
});
export type WebhookEventDocument = S.Schema.Type<typeof WebhookEventDocument>;

// Membership card schema
export const MembershipCard = S.Struct({
  id: S.String,
  userId: S.String,
  membershipNumber: S.String, // Format: DEC-2025-000001
  memberName: S.String,
  email: S.String,
  planType: PlanType,
  status: MembershipStatus,
  validFrom: S.String, // ISO date
  validUntil: S.String, // ISO date
  qrCodeData: S.String, // Encoded verification data
  pdfUrl: S.NullOr(S.String), // Reserved for future PDF generation (currently null)
  createdAt: S.String,
  updatedAt: S.String,
});
export type MembershipCard = S.Schema.Type<typeof MembershipCard>;

// QR code payload (what's encoded in the QR)
export const QRPayload = S.Struct({
  mn: S.String, // membership number
  u: S.String, // user ID (truncated)
  v: S.String, // valid until (compact date)
  s: S.String, // signature hash
});
export type QRPayload = S.Schema.Type<typeof QRPayload>;

// Verification result
export const VerificationResult = S.Struct({
  valid: S.Boolean,
  membershipNumber: S.String,
  memberName: S.String,
  planType: PlanType,
  status: MembershipStatus,
  expiresAt: S.String,
  daysRemaining: S.Number,
  message: S.String,
});
export type VerificationResult = S.Schema.Type<typeof VerificationResult>;

// Counter document for membership numbers
export const MembershipCounter = S.Struct({
  year: S.Number,
  lastNumber: S.Number,
  updatedAt: S.Any,
});
export type MembershipCounter = S.Schema.Type<typeof MembershipCounter>;

// Admin stats schema
export const MembershipStats = S.Struct({
  totalMembers: S.Number,
  activeMembers: S.Number,
  expiredMembers: S.Number,
  canceledMembers: S.Number,
  individualCount: S.Number,
  familyCount: S.Number,
  monthlyRevenue: S.Number,
  yearlyRevenue: S.Number,
  updatedAt: S.String,
});
export type MembershipStats = S.Schema.Type<typeof MembershipStats>;

// Member search params
export const MemberSearchParams = S.Struct({
  query: S.optional(S.String),
  status: S.optional(MembershipStatus),
  planType: S.optional(PlanType),
  expiringWithinDays: S.optional(S.Number),
  page: S.optional(S.Number),
  pageSize: S.optional(S.Number),
});
export type MemberSearchParams = S.Schema.Type<typeof MemberSearchParams>;

// Member with membership (joined data)
export const MemberWithMembership = S.Struct({
  user: S.NullOr(UserDocument),
  membership: S.NullOr(MembershipDocument),
  card: S.NullOr(MembershipCard),
});
export type MemberWithMembership = S.Schema.Type<typeof MemberWithMembership>;

// Membership adjustment request
export const MembershipAdjustment = S.Struct({
  userId: S.String,
  membershipId: S.String,
  newEndDate: S.optional(S.String),
  newStatus: S.optional(MembershipStatus),
  reason: S.String,
});
export type MembershipAdjustment = S.Schema.Type<typeof MembershipAdjustment>;

// Admin claim management
export const AdminClaimRequest = S.Struct({
  uid: S.String,
  isAdmin: S.Boolean,
});
export type AdminClaimRequest = S.Schema.Type<typeof AdminClaimRequest>;

// Export options
export const ExportOptions = S.Struct({
  includeEmail: S.Boolean,
  includePhone: S.Boolean,
  includeAddress: S.Boolean,
  statusFilter: S.optional(MembershipStatus),
  format: S.Literal('csv', 'json'),
});
export type ExportOptions = S.Schema.Type<typeof ExportOptions>;

// ============================================================================
// Reconciliation Types
// ============================================================================

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

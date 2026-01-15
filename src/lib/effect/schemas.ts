import { Schema as S } from "@effect/schema";

// Membership status enum
export const MembershipStatus = S.Literal(
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "unpaid"
);
export type MembershipStatus = S.Schema.Type<typeof MembershipStatus>;

// Plan type enum
export const PlanType = S.Literal("individual", "family");
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
  interval: S.Literal("year", "month"),
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
    })
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

/**
 * Membership plan benefits configuration
 * Benefits are stored in code since they're the same across test/prod environments
 * while price IDs differ between environments (stored in env vars)
 */

interface PlanBenefits {
  [priceId: string]: string[];
}

// Map Stripe price IDs to their benefits
export const PLAN_BENEFITS: PlanBenefits = {
  // Individual plan benefits
  [process.env.STRIPE_PRICE_INDIVIDUAL || ""]: [
    "10% discount at The Bicycle Shop and Bicycle Gallery after 30 days",
    "Access to club-sponsored events and group rides",
    "Insured group rides and centuries",
    "Support for local cycling advocacy",
  ],

  // Family plan benefits
  [process.env.STRIPE_PRICE_FAMILY || ""]: [
    "10% discount at The Bicycle Shop and Bicycle Gallery after 30 days",
    "Access to club-sponsored events and group rides for entire family",
    "Insured group rides and centuries",
    "Support for local cycling advocacy",
    "Covers all family members under one membership",
  ],
};

/**
 * Get benefits for a given Stripe price ID
 */
export function getBenefitsForPriceId(priceId: string): string[] {
  return PLAN_BENEFITS[priceId] || [];
}

/**
 * Get all configured plan price IDs
 */
export function getConfiguredPriceIds(): string[] {
  return [process.env.STRIPE_PRICE_INDIVIDUAL, process.env.STRIPE_PRICE_FAMILY].filter(
    Boolean,
  ) as string[];
}

/**
 * Plan type to name mapping
 */
export const PLAN_TYPE_NAMES: Record<string, string> = {
  individual: "Individual Annual Membership",
  family: "Family Annual Membership",
};

/**
 * Get plan name for a plan type
 */
export function getPlanNameForType(planType: string): string {
  return PLAN_TYPE_NAMES[planType] || "Membership";
}

import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { StripeService } from "@/src/lib/effect/stripe.service";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { WebhookIdempotencyService } from "@/src/lib/effect/webhook-idempotency.service";
import { MembershipCardService } from "@/src/lib/effect/card.service";
import { FirestoreService } from "@/src/lib/effect/firestore.service";
import { StatsService } from "@/src/lib/effect/stats.service";
import { LiveLayer } from "@/src/lib/effect/layers";

// Map price IDs to plan types for stats tracking
const PRICE_TO_PLAN_TYPE: Record<string, "individual" | "family"> = {
  [process.env.STRIPE_PRICE_INDIVIDUAL || ""]: "individual",
  [process.env.STRIPE_PRICE_FAMILY || ""]: "family",
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Define the webhook processing pipeline with idempotency
  const program = pipe(
    // Step 1: Verify webhook signature
    Effect.flatMap(StripeService, (stripe) => stripe.verifyWebhookSignature(body, signature)),

    // Step 2: Check idempotency and process event
    Effect.flatMap((event) =>
      Effect.flatMap(WebhookIdempotencyService, (idempotency) =>
        Effect.flatMap(MembershipService, (membershipService) =>
          Effect.gen(function* () {
            yield* Effect.log(`Processing webhook event: ${event.type} (${event.id})`);

            // Claim the event (atomic operation - fails if already processed)
            yield* idempotency.claimEvent(event.id, event.type);

            try {
              switch (event.type) {
                case "checkout.session.completed": {
                  const session = event.data.object as Stripe.Checkout.Session;
                  yield* Effect.log(
                    `[WEBHOOK] checkout.session.completed - Session: ${session.id}, Customer: ${session.customer}, Subscription: ${session.subscription}`,
                  );
                  yield* membershipService.processCheckoutCompleted(session);

                  // Generate membership card after successful checkout
                  yield* Effect.gen(function* () {
                    const cardService = yield* MembershipCardService;
                    const firestore = yield* FirestoreService;

                    // Get user and membership data
                    const userId = session.metadata?.userId || (session.subscription as string);
                    const user = yield* firestore.getUser(userId);
                    const membership = yield* firestore.getActiveMembership(userId);

                    if (user && membership) {
                      yield* Effect.log(`[WEBHOOK] Creating membership card for user ${userId}`);
                      yield* cardService.createCard({ userId, user, membership });
                      yield* Effect.log(`[WEBHOOK] Membership card created for user ${userId}`);
                    } else {
                      yield* Effect.log(
                        `[WEBHOOK] Skipping card creation - user: ${!!user}, membership: ${!!membership}`,
                      );
                    }
                  }).pipe(
                    Effect.catchAll((error) => {
                      // Log card creation errors but don't fail the webhook
                      console.error("[WEBHOOK] Card creation error (non-fatal):", error);
                      return Effect.succeed(undefined);
                    }),
                  );

                  // Update stats after successful checkout
                  yield* Effect.gen(function* () {
                    const stats = yield* StatsService;
                    yield* stats.incrementStat("totalMembers");
                    yield* stats.incrementStat("activeMembers");

                    // Determine plan type from session metadata or line items
                    const priceId = session.metadata?.priceId || "";
                    const planType = PRICE_TO_PLAN_TYPE[priceId] || "individual";

                    if (planType === "family") {
                      yield* stats.incrementStat("familyCount");
                    } else {
                      yield* stats.incrementStat("individualCount");
                    }

                    yield* Effect.log(`[WEBHOOK] Stats updated for new ${planType} membership`);
                  }).pipe(
                    Effect.catchAll((error) => {
                      console.error("[WEBHOOK] Stats update error (non-fatal):", error);
                      return Effect.succeed(undefined);
                    }),
                  );
                  break;
                }

                case "customer.subscription.updated": {
                  const subscription = event.data.object as Stripe.Subscription;
                  yield* Effect.log(
                    `[WEBHOOK] customer.subscription.updated - Subscription: ${subscription.id}, Status: ${subscription.status}, Customer: ${subscription.customer}`,
                  );
                  yield* membershipService.processSubscriptionUpdated(subscription);
                  break;
                }

                case "customer.subscription.deleted": {
                  const subscription = event.data.object as Stripe.Subscription;
                  yield* Effect.log(
                    `[WEBHOOK] customer.subscription.deleted - Subscription: ${subscription.id}, Status: ${subscription.status}, Customer: ${subscription.customer}`,
                  );
                  yield* membershipService.processSubscriptionDeleted(subscription);

                  // Update stats after subscription deletion
                  yield* Effect.gen(function* () {
                    const stats = yield* StatsService;
                    yield* stats.decrementStat("activeMembers");
                    yield* stats.incrementStat("canceledMembers");
                    yield* Effect.log(`[WEBHOOK] Stats updated for canceled subscription`);
                  }).pipe(
                    Effect.catchAll((error) => {
                      console.error("[WEBHOOK] Stats update error (non-fatal):", error);
                      return Effect.succeed(undefined);
                    }),
                  );
                  break;
                }

                case "invoice.payment_failed": {
                  // Log payment failures for monitoring
                  // Stripe handles retries automatically via Smart Retries
                  const invoice = event.data.object as Stripe.Invoice;
                  // subscription field may be string ID or expanded object
                  const invoiceData = invoice as unknown as Record<string, unknown>;
                  const subscriptionId =
                    typeof invoiceData.subscription === "string"
                      ? invoiceData.subscription
                      : ((invoiceData.subscription as { id?: string } | null)?.id ?? "unknown");
                  yield* Effect.log(
                    `[WEBHOOK] invoice.payment_failed - Invoice: ${invoice.id}, Customer: ${invoice.customer}, Subscription: ${subscriptionId}, Attempt: ${invoice.attempt_count}`,
                  );
                  // No action needed - Stripe Smart Retries handles this
                  // Subscription status will update to past_due/unpaid automatically
                  break;
                }

                default:
                  yield* Effect.log(`Unhandled event type: ${event.type}`);
              }

              // Mark event as completed
              yield* idempotency.completeEvent(event.id);
              return { received: true };
            } catch (error) {
              // Mark event as failed for retry
              yield* idempotency.failEvent(
                event.id,
                error instanceof Error ? error.message : "Unknown error",
              );
              throw error;
            }
          }),
        ),
      ),
    ),

    // Step 3: Error handling
    Effect.catchTag("DuplicateWebhookError", (error) => {
      // Duplicate is fine - return 200 so Stripe doesn't retry
      console.log(
        `Duplicate webhook event ${error.eventId}, already processed at ${error.processedAt}`,
      );
      return Effect.succeed({ received: true, duplicate: true });
    }),
    Effect.catchTag("StripeError", (error) => {
      console.error("Stripe error in webhook:", error);
      return Effect.succeed({ error: error.message, _tag: "error" as const, status: 400 });
    }),
    Effect.catchTag("FirestoreError", (error) => {
      console.error("Firestore error in webhook:", error);
      return Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 });
    }),
  );

  // Run with live services
  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

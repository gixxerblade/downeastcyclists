import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { StripeService } from "@/src/lib/effect/stripe.service";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Define the webhook processing pipeline
  const program = pipe(
    // Step 1: Verify webhook signature
    Effect.flatMap(StripeService, (stripe) =>
      stripe.verifyWebhookSignature(body, signature)
    ),

    // Step 2: Process event based on type
    Effect.flatMap((event) =>
      Effect.flatMap(MembershipService, (membershipService) =>
        Effect.gen(function* () {
          yield* Effect.log(`Processing webhook event: ${event.type}`);

          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              yield* membershipService.processCheckoutCompleted(session);
              break;
            }

            case "customer.subscription.updated": {
              const subscription = event.data.object as Stripe.Subscription;
              yield* membershipService.processSubscriptionUpdated(subscription);
              break;
            }

            case "customer.subscription.deleted": {
              const subscription = event.data.object as Stripe.Subscription;
              yield* membershipService.processSubscriptionDeleted(subscription);
              break;
            }

            default:
              yield* Effect.log(`Unhandled event type: ${event.type}`);
          }

          return { received: true };
        })
      )
    ),

    // Step 3: Error handling
    Effect.catchTag("StripeError", (error) => {
      console.error("Stripe error in webhook:", error);
      return Effect.succeed({ error: error.message, _tag: "error" as const, status: 400 });
    }),
    Effect.catchTag("FirestoreError", (error) => {
      console.error("Firestore error in webhook:", error);
      return Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 });
    })
  );

  // Run with live services
  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

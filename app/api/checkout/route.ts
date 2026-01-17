import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { Schema as S } from "@effect/schema";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";
import { CheckoutSessionRequest } from "@/src/lib/effect/schemas";
import { ValidationError } from "@/src/lib/effect/errors";

export async function POST(request: NextRequest) {
  // Parse request body
  const body = await request.json();

  // Define the Effect program
  const program = pipe(
    // Step 1: Validate input with Effect Schema
    S.decodeUnknown(CheckoutSessionRequest)(body),
    Effect.mapError(
      (error) =>
        new ValidationError({
          field: "body",
          message: "Invalid request body",
          cause: error,
        }),
    ),

    // Step 2: Create checkout session
    Effect.flatMap((validatedRequest) =>
      Effect.flatMap(MembershipService, (membershipService) =>
        membershipService.createCheckoutSession(validatedRequest),
      ),
    ),

    // Step 3: Handle specific errors with catchTag
    Effect.catchTag("ValidationError", (error) =>
      Effect.succeed({
        error: error.message,
        field: error.field,
        _tag: "error" as const,
        status: 400,
      }),
    ),
    Effect.catchTag("StripeError", (error) =>
      Effect.succeed({
        error: error.message,
        code: error.code,
        _tag: "error" as const,
        status: 500,
      }),
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({
        error: error.message,
        _tag: "error" as const,
        status: 500,
      }),
    ),
  );

  // Run with live services
  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  // Return appropriate response
  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

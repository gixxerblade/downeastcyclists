import { NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { MembershipService } from "@/src/lib/effect/membership.service";
import { LiveLayer } from "@/src/lib/effect/layers";

// Prevent static generation of this route
export const dynamic = "force-dynamic";

// In-memory cache for plans
let cachedPlans: Array<{
  id: string;
  name: string;
  price: number;
  benefits: string[];
  stripePriceId: string;
}> | null = null;
let cachedAt: number = 0;
const CACHE_TTL = 300_000; // 5 minutes

export async function GET() {
  const now = Date.now();

  // Return cached plans if valid
  if (cachedPlans && now - cachedAt < CACHE_TTL) {
    return NextResponse.json(cachedPlans);
  }

  const program = pipe(
    Effect.flatMap(MembershipService, (membershipService) => membershipService.getPlans()),

    Effect.catchTag("StripeError", (error) =>
      Effect.succeed({
        error: error.message,
        _tag: "error" as const,
        status: 500,
      }),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Update cache - result is now definitely the plans array
  const plans = result as Array<{
    id: string;
    name: string;
    price: number;
    benefits: string[];
    stripePriceId: string;
  }>;
  cachedPlans = plans;
  cachedAt = now;

  return NextResponse.json(plans);
}

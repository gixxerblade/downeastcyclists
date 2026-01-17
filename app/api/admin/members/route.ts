import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { AdminService } from "@/src/lib/effect/admin.service";
import { LiveLayer } from "@/src/lib/effect/layers";
import type { MemberSearchParams } from "@/src/lib/effect/schemas";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const params: MemberSearchParams = {
    query: searchParams.get("query") || undefined,
    status: (searchParams.get("status") as MemberSearchParams["status"]) || undefined,
    planType: (searchParams.get("planType") as MemberSearchParams["planType"]) || undefined,
    expiringWithinDays: searchParams.get("expiringWithinDays")
      ? parseInt(searchParams.get("expiringWithinDays")!)
      : undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
    pageSize: searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 20,
  };

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;

      // Verify admin access
      yield* admin.verifyAdmin(sessionCookie);

      // Search members
      return yield* admin.searchMembers(params);
    }),

    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 403 }),
    ),
    Effect.catchTag("SessionError", () =>
      Effect.succeed({ error: "Session expired", _tag: "error" as const, status: 401 }),
    ),
    Effect.catchTag("AuthError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 401 }),
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 }),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

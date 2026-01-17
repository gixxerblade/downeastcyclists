"use server";

import { Effect, pipe, Exit } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalService } from "@/src/lib/effect/portal.service";
import { LiveLayer } from "@/src/lib/effect/layers";
import type { MemberDashboardResponse } from "@/src/lib/effect/schemas";

type DashboardResult =
  | { success: true; data: MemberDashboardResponse }
  | { success: false; error: string; redirect?: string };

// Get member dashboard data - Effect.gen for complex flow
export async function getMemberDashboard(): Promise<MemberDashboardResponse | { error: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;

    // Verify session
    const session = yield* portal.verifySession(sessionCookie);

    // Get dashboard data
    return yield* portal.getMemberDashboard(session.uid);
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));

  if (Exit.isFailure(exit)) {
    const cause = exit.cause;
    // Check the error type from the cause
    const failure = cause._tag === "Fail" ? cause.error : null;

    if (failure && typeof failure === "object" && "_tag" in failure) {
      if (failure._tag === "SessionError") {
        redirect("/login");
      }
      if (failure._tag === "NotFoundError" && "resource" in failure) {
        return { error: `${failure.resource} not found` };
      }
      if (failure._tag === "FirestoreError" && "message" in failure) {
        return { error: failure.message as string };
      }
    }
    return { error: "An unexpected error occurred" };
  }

  return exit.value;
}

// Redirect to Stripe Customer Portal
export async function redirectToPortal(returnUrl: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  const program = Effect.gen(function* () {
    const portal = yield* PortalService;

    // Verify session
    const session = yield* portal.verifySession(sessionCookie);

    // Create portal session
    const result = yield* portal.createPortalSession(session.uid, returnUrl);
    return result.url;
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LiveLayer)));

  if (Exit.isFailure(exit)) {
    const cause = exit.cause;
    const failure = cause._tag === "Fail" ? cause.error : null;

    if (failure && typeof failure === "object" && "_tag" in failure) {
      if (failure._tag === "SessionError") {
        redirect("/login");
      }
    }
    // For NotFoundError and StripeError, just return without redirect
    return;
  }

  if (exit.value) {
    redirect(exit.value);
  }
}

"use server";

import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalService } from "@/src/lib/effect/portal.service";
import { LiveLayer } from "@/src/lib/effect/layers";

export type AuthState = {
  error?: string;
  success?: boolean;
};

// Verify current session - use Effect.catchAll for safe fallback
export async function verifySession(): Promise<{
  authenticated: boolean;
  userId?: string;
  email?: string;
}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return { authenticated: false };
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const session = yield* portal.verifySession(sessionCookie);
      return {
        authenticated: true as const,
        userId: session.uid,
        email: session.email,
      };
    }),

    Effect.catchAll(() => Effect.succeed({ authenticated: false as const })),
  );

  return Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));
}

// Sign out action
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/");
}

// Get current user from session
export async function getCurrentUser() {
  const session = await verifySession();

  if (!session.authenticated || !session.userId) {
    return null;
  }

  return {
    uid: session.userId,
    email: session.email,
  };
}

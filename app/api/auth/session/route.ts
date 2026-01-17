import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { AuthService, AuthServiceLive } from "@/src/lib/effect/auth.service";

export const dynamic = "force-dynamic";

const SESSION_COOKIE_NAME = "session";
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  if (!idToken) {
    return NextResponse.json({ error: "ID token is required" }, { status: 400 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const auth = yield* AuthService;

      // Verify the ID token first
      yield* auth.verifyIdToken(idToken);

      // Create session cookie
      const sessionCookie = yield* auth.createSessionCookie(idToken, SESSION_EXPIRES_IN);

      return sessionCookie;
    }),

    Effect.catchTag("AuthError", (error) =>
      Effect.succeed({
        error: error.message,
        _tag: "error" as const,
        status: 401,
      }),
    ),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(AuthServiceLive)));

  if (typeof result === "object" && "_tag" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, result, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRES_IN / 1000,
    path: "/",
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false });
  }

  const program = pipe(
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const session = yield* auth.verifySessionCookie(sessionCookie);
      return {
        authenticated: true,
        email: session.email,
        uid: session.uid,
      };
    }),

    Effect.catchAll(() => Effect.succeed({ authenticated: false as const })),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(AuthServiceLive)));

  return NextResponse.json(result);
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}

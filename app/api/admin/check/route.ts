import { NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { AdminService } from "@/src/lib/effect/admin.service";
import { LiveLayer } from "@/src/lib/effect/layers";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ isAdmin: false, authenticated: false }, { status: 200 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;
      const adminUser = yield* admin.verifyAdmin(sessionCookie);
      return { isAdmin: true, authenticated: true, uid: adminUser.uid, email: adminUser.email };
    }),

    Effect.catchAll(() => Effect.succeed({ isAdmin: false, authenticated: true })),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  return NextResponse.json(result);
}

import {Effect, pipe} from 'effect';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {AdminService} from '@/src/lib/effect/admin.service';
import {LiveLayer} from '@/src/lib/effect/layers';

/**
 * Standard error tags handled by admin routes
 */
type AdminErrorTag =
  | 'UnauthorizedError'
  | 'SessionError'
  | 'AuthError'
  | 'StripeError'
  | 'FirestoreError'
  | 'CardError'
  | 'QRError'
  | 'AdminError';

/**
 * Error result with status code
 */
type ErrorResult = {
  error: string;
  _tag: 'error';
  status: number;
};

/**
 * Common error handlers for admin routes
 */
const errorHandlers = {
  UnauthorizedError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 403}),
  SessionError: () =>
    Effect.succeed({error: 'Session expired', _tag: 'error' as const, status: 401}),
  AuthError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 401}),
  StripeError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
  FirestoreError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
  CardError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
  QRError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
  AdminError: (error: {message: string}) =>
    Effect.succeed({error: error.message, _tag: 'error' as const, status: 500}),
};

/**
 * Options for admin route handler
 */
export type AdminRouteOptions = {
  /**
   * Effect program that performs the admin operation.
   * Receives AdminService and sessionCookie.
   */
  handler: (admin: AdminService, sessionCookie: string) => Effect.Effect<any, any, any>;

  /**
   * Error tags to handle. Defaults to all standard admin error tags.
   */
  errorTags?: AdminErrorTag[];
};

/**
 * Wraps an admin route handler with standard authentication, error handling, and response formatting.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return handleAdminRoute({
 *     handler: (admin, sessionCookie) => Effect.gen(function* () {
 *       yield* admin.verifyAdmin(sessionCookie);
 *       const email = request.nextUrl.searchParams.get('email');
 *       if (!email) {
 *         return yield* Effect.fail(new AdminError({ message: 'Email required' }));
 *       }
 *       return yield* admin.validateStripeVsFirebase(email);
 *     }),
 *     errorTags: ['UnauthorizedError', 'SessionError', 'AuthError', 'StripeError', 'FirestoreError', 'AdminError']
 *   });
 * }
 */
export async function handleAdminRoute(options: AdminRouteOptions): Promise<NextResponse> {
  const {handler, errorTags = Object.keys(errorHandlers) as AdminErrorTag[]} = options;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({error: 'Not authenticated'}, {status: 401});
  }

  const program: any = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;
      return yield* handler(admin, sessionCookie);
    }),
    Effect.catchTags(
      errorTags.reduce(
        (acc, tag) => {
          const handler = errorHandlers[tag];
          if (handler) {
            acc[tag] = handler;
          }
          return acc;
        },
        {} as Record<string, (error: any) => Effect.Effect<ErrorResult, never, never>>,
      ),
    ),
    // Catch-all for unexpected errors
    Effect.catchAll((error: unknown) => {
      console.error('Unexpected error in admin route:', error);
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      return Effect.succeed({
        error: message,
        _tag: 'error' as const,
        status: 500,
      });
    }),
  );

  const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

  if (
    typeof result === 'object' &&
    result !== null &&
    '_tag' in result &&
    result._tag === 'error'
  ) {
    const errorResult = result as ErrorResult;
    return NextResponse.json({error: errorResult.error}, {status: errorResult.status});
  }

  return NextResponse.json(result);
}

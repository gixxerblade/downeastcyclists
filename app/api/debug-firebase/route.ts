import {NextResponse} from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Wrap everything in a try-catch to ensure we always return something
  try {
    const debugInfo: {
      firestoreInit: string;
      firestoreError: string | null;
      firestoreStack?: string;
      firebaseAdminInit: string;
      firebaseAdminError: string | null;
      firebaseAdminStack?: string;
      authServiceInit: string;
      authServiceError: string | null;
      authServiceStack?: string;
    } = {
      firestoreInit: 'not-attempted',
      firestoreError: null,
      firebaseAdminInit: 'not-attempted',
      firebaseAdminError: null,
      authServiceInit: 'not-attempted',
      authServiceError: null,
    };

    // Test 1: Firestore Client
    try {
      debugInfo.firestoreInit = 'importing';
      const {getFirestoreClient} = await import('@/src/lib/firestore-client');
      debugInfo.firestoreInit = 'initializing';
      const db = getFirestoreClient();
      debugInfo.firestoreInit = 'querying';
      // Try a simple operation
      await db.collection('trails').limit(1).get();
      debugInfo.firestoreInit = 'success';
    } catch (error) {
      debugInfo.firestoreInit = 'failed';
      debugInfo.firestoreError =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      debugInfo.firestoreStack = error instanceof Error ? error.stack : undefined;
    }

    // Test 2: Firebase Admin (synchronous getter)
    try {
      debugInfo.firebaseAdminInit = 'importing';
      const {getFirebaseAdmin} = await import('@/src/lib/firebase-admin');
      debugInfo.firebaseAdminInit = 'getting-auth';
      const {auth} = getFirebaseAdmin();
      // Just check if we can get the auth instance
      if (auth) {
        debugInfo.firebaseAdminInit = 'success';
      } else {
        debugInfo.firebaseAdminInit = 'failed';
        debugInfo.firebaseAdminError = 'Auth instance is null';
      }
    } catch (error) {
      debugInfo.firebaseAdminInit = 'failed';
      debugInfo.firebaseAdminError =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      debugInfo.firebaseAdminStack = error instanceof Error ? error.stack : undefined;
    }

    // Test 3: Effect-based Auth Service
    try {
      debugInfo.authServiceInit = 'importing';
      const {Effect} = await import('effect');
      const {AuthService, AuthServiceLive} = await import('@/src/lib/effect/auth.service');

      debugInfo.authServiceInit = 'creating-program';
      const testProgram = Effect.gen(function* () {
        const auth = yield* AuthService;
        // Try to verify a dummy token (should fail, but we just want to check if service initializes)
        return 'service-initialized';
      });

      debugInfo.authServiceInit = 'running-program';
      await Effect.runPromise(testProgram.pipe(Effect.provide(AuthServiceLive)));
      debugInfo.authServiceInit = 'success';
    } catch (error) {
      debugInfo.authServiceInit = 'failed';
      debugInfo.authServiceError =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      debugInfo.authServiceStack = error instanceof Error ? error.stack : undefined;
    }

    return NextResponse.json(debugInfo, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (topLevelError) {
    // If even the top level fails, return a minimal error response
    return NextResponse.json(
      {
        topLevelError: 'Entire endpoint crashed',
        message: topLevelError instanceof Error ? topLevelError.message : String(topLevelError),
        stack: topLevelError instanceof Error ? topLevelError.stack : undefined,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  }
}

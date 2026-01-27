import {NextResponse} from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const debugInfo: {
    firestoreInit: string;
    firestoreError: string | null;
    firebaseAdminInit: string;
    firebaseAdminError: string | null;
    authServiceInit: string;
    authServiceError: string | null;
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
    const {getFirestoreClient} = await import('@/src/lib/firestore-client');
    const db = getFirestoreClient();
    // Try a simple operation
    await db.collection('trails').limit(1).get();
    debugInfo.firestoreInit = 'success';
  } catch (error) {
    debugInfo.firestoreInit = 'failed';
    debugInfo.firestoreError =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  // Test 2: Firebase Admin (synchronous getter)
  try {
    const {getFirebaseAdmin} = await import('@/src/lib/firebase-admin');
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
  }

  // Test 3: Effect-based Auth Service
  try {
    const {Effect} = await import('effect');
    const {AuthService, AuthServiceLive} = await import('@/src/lib/effect/auth.service');

    const testProgram = Effect.gen(function* () {
      const auth = yield* AuthService;
      // Try to verify a dummy token (should fail, but we just want to check if service initializes)
      return 'service-initialized';
    });

    await Effect.runPromise(testProgram.pipe(Effect.provide(AuthServiceLive)));
    debugInfo.authServiceInit = 'success';
  } catch (error) {
    debugInfo.authServiceInit = 'failed';
    debugInfo.authServiceError =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  return NextResponse.json(debugInfo, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

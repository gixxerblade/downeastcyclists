import {Effect, pipe} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {AuthService} from '@/src/lib/effect/auth.service';
import {DatabaseService} from '@/src/lib/effect/database.service';
import {LiveLayer} from '@/src/lib/effect/layers';

export const dynamic = 'force-dynamic';

interface SignupRequest {
  idToken: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {idToken, name} = (await request.json()) as SignupRequest;

    if (!idToken) {
      return NextResponse.json({error: 'ID token is required'}, {status: 400});
    }

    const program = pipe(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        const db = yield* DatabaseService;

        // Verify the ID token and get user info
        const decodedToken = yield* auth.verifyIdToken(idToken);

        // Check if user already exists
        const existingUser = yield* db.getUser(decodedToken.uid);

        if (existingUser) {
          yield* Effect.log(`User ${decodedToken.uid} already exists`);
          return {success: true, userId: decodedToken.uid};
        }

        // Create user document
        yield* db.setUser(
          decodedToken.uid,
          {
            id: decodedToken.uid,
            email: decodedToken.email || '',
            name: name,
            createdAt: new Date().toISOString(),
          } as any,
          false, // Don't merge, create new document
        );

        yield* Effect.log(`Created user document for ${decodedToken.uid}`);

        return {success: true, userId: decodedToken.uid};
      }),

      Effect.catchTag('AuthError', (error) =>
        Effect.succeed({
          error: error.message,
          _tag: 'error' as const,
          status: 401,
        }),
      ),

      Effect.catchTag('DatabaseError', (error) =>
        Effect.succeed({
          error: error.message,
          _tag: 'error' as const,
          status: 500,
        }),
      ),
    );

    const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)));

    if (typeof result === 'object' && '_tag' in result) {
      return NextResponse.json({error: result.error}, {status: result.status});
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in signup route:', error);
    return NextResponse.json({error: 'Failed to create user'}, {status: 500});
  }
}

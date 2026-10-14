import {Effect, pipe} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {AuthService} from '@/src/lib/effect/auth.service';
import {LiveLayer} from '@/src/lib/effect/layers';
import {ensureMemberProfile} from '@/src/lib/effect/membership.service';

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

        // Verify the ID token and get user info
        const decodedToken = yield* auth.verifyIdToken(idToken);

        return yield* ensureMemberProfile(decodedToken, name);
      }),

      Effect.catchTag('AuthError', () =>
        Effect.succeed({
          error: 'Invalid or expired credentials',
          _tag: 'error' as const,
          status: 401,
        }),
      ),

      Effect.catchTag('DatabaseError', () =>
        Effect.succeed({
          error: 'Unable to create user',
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

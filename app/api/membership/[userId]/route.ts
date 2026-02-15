import {Effect, pipe} from 'effect';
import {NextRequest, NextResponse} from 'next/server';

import {LiveLayer} from '@/src/lib/effect/layers';
import {MembershipService} from '@/src/lib/effect/membership.service';

interface RouteParams {
  params: Promise<{userId: string}>;
}

export async function GET(request: NextRequest, {params}: RouteParams) {
  const {userId} = await params;

  if (!userId) {
    return NextResponse.json({error: 'User ID is required'}, {status: 400});
  }

  const program = pipe(
    Effect.flatMap(MembershipService, (membershipService) =>
      membershipService.getMembershipStatus(userId),
    ),

    Effect.catchTag('NotFoundError', (error) =>
      Effect.succeed({
        error: `${error.resource} not found`,
        _tag: 'error' as const,
        status: 404,
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

  if ('_tag' in result && result._tag === 'error') {
    return NextResponse.json({error: result.error}, {status: result.status});
  }

  return NextResponse.json(result);
}

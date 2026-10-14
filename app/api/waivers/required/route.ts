import {Effect} from 'effect';
import {NextResponse} from 'next/server';

import {getRequiredMembershipWaivers} from '@/src/lib/waivers/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await Effect.runPromise(
    getRequiredMembershipWaivers().pipe(
      Effect.catchTag('DatabaseError', () => Effect.succeed(null)),
      Effect.catchTag('WaiverConfigurationError', () => Effect.succeed(null)),
    ),
  );
  if (!result?.length) {
    return NextResponse.json(
      {
        error:
          'Membership waiver signing is temporarily unavailable. Please contact the club administrator.',
      },
      {status: 503},
    );
  }
  return NextResponse.json(result);
}

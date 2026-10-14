import {Effect} from 'effect';
import {NextResponse} from 'next/server';

import {getRequiredMembershipWaiver} from '@/src/lib/waivers/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await Effect.runPromise(
    getRequiredMembershipWaiver().pipe(
      Effect.catchTag('DatabaseError', () => Effect.succeed(null)),
    ),
  );
  if (!result) {
    return NextResponse.json({error: 'No required membership waiver is available'}, {status: 404});
  }
  return NextResponse.json(result);
}

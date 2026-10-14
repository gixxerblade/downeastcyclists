import {queryOptions} from '@tanstack/react-query';
import type {Effect} from 'effect';

import type {getMemberWaiverContext} from './service';

export type MemberWaiverContext = Effect.Effect.Success<ReturnType<typeof getMemberWaiverContext>>;
export type MemberWaiver = MemberWaiverContext['waivers'][number];

export const memberWaiversQueryKey = (userId: string) => ['member', 'waivers', userId];

export function memberWaiversQueryOptions(userId: string) {
  return queryOptions({
    queryKey: memberWaiversQueryKey(userId),
    queryFn: async ({signal}): Promise<MemberWaiverContext> => {
      const response = await fetch('/api/member/waivers', {cache: 'no-store', signal});
      const body: MemberWaiverContext = await response.json();
      if (
        !response.ok ||
        body.userId !== userId ||
        !Array.isArray(body.waivers) ||
        typeof body.requireHousehold !== 'boolean'
      ) {
        throw new Error('Unable to verify your waiver status. Please sign in again.');
      }
      return body;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

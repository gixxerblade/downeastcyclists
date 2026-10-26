import {Effect} from 'effect';
import {NextRequest} from 'next/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {UnauthorizedError, ValidationError} from '@/src/lib/effect/errors';

const mocks = vi.hoisted(() => ({session: vi.fn(), verifyAdmin: vi.fn(), send: vi.fn()}));
vi.mock('next/headers', () => ({cookies: async () => ({get: mocks.session})}));
vi.mock('@/src/lib/effect/layers', async () => {
  const {Context, Layer} = await import('effect');
  return {
    LiveLayer: Layer.succeed(Context.GenericTag<unknown>('AdminService'), {
      verifyAdmin: mocks.verifyAdmin,
      sendRenewalEmail: mocks.send,
    }),
  };
});

import {POST} from '@/app/api/admin/members/[userId]/renewal-email/route';

const post = (resend: boolean) =>
  POST(
    new NextRequest('https://club.example/api/admin/members/member/renewal-email', {
      method: 'POST',
      body: JSON.stringify({resend}),
      headers: {'Content-Type': 'application/json'},
    }),
    {params: Promise.resolve({userId: 'member'})},
  );

beforeEach(() => {
  mocks.session.mockReturnValue({value: 'session'});
  mocks.verifyAdmin.mockReturnValue(Effect.succeed({uid: 'admin', email: 'admin@example.test'}));
  mocks.send.mockReturnValue(
    Effect.fail(
      new ValidationError({
        field: 'membership',
        message: 'This membership renews automatically.',
      }),
    ),
  );
});

describe('admin renewal email boundary', () => {
  it.each([false, true])(
    'returns an actionable rejection for automatic subscribers (resend: %s)',
    async (resend) => {
      const response = await post(resend);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({error: 'This membership renews automatically.'});
      expect(mocks.send).toHaveBeenCalledWith('member', 'admin', 'admin@example.test', {resend});
    },
  );
  it('requires an administrative session before invoking email eligibility', async () => {
    mocks.session.mockReturnValue(undefined);
    expect((await post(false)).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.session.mockReturnValue({value: 'session'});
    mocks.verifyAdmin.mockReturnValue(Effect.fail(new UnauthorizedError({message: 'Forbidden'})));
    expect((await post(true)).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

import {Effect} from 'effect';
import {NextRequest} from 'next/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {UnauthorizedError} from '@/src/lib/effect/errors';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  session: vi.fn(),
  preview: vi.fn(),
  test: vi.fn(),
  send: vi.fn(),
}));
vi.mock('next/headers', () => ({cookies: async () => ({get: mocks.session})}));
vi.mock('@/src/lib/effect/layers', async () => {
  const {Context, Layer} = await import('effect');
  return {
    LiveLayer: Layer.succeed(Context.GenericTag<unknown>('AdminService'), {
      authorize: mocks.authorize,
    }),
  };
});
vi.mock('@/src/lib/waivers/service', () => ({
  previewWaiverEmail: mocks.preview,
  sendTestWaiverEmail: mocks.test,
  sendUnsignedWaiverEmails: mocks.send,
}));

import {GET, POST} from '@/app/api/admin/waivers/notifications/route';

const id = '11111111-1111-4111-8111-111111111111';
const actor = {uid: 'admin', email: 'admin@example.test'};
const result = {sent: 1, skipped: 0, failed: 0};
const post = (body: unknown) =>
  POST(
    new NextRequest('https://club.example/api/admin/waivers/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    }),
  );
const get = () =>
  GET(new NextRequest(`https://club.example/api/admin/waivers/notifications?templateId=${id}`));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue({value: 'verified-session'});
  mocks.authorize.mockReturnValue(Effect.succeed(actor));
  mocks.preview.mockReturnValue(
    Effect.succeed({
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
      from: 'Club',
      testRecipient: actor.email,
    }),
  );
  mocks.test.mockReturnValue(Effect.succeed(result));
  mocks.send.mockReturnValue(Effect.succeed(result));
});

describe('admin waiver email boundary', () => {
  it('requires a session before preview or sending', async () => {
    mocks.session.mockReturnValue(undefined);
    expect((await get()).status).toBe(401);
    expect((await post({action: 'test', templateId: id, requestId: id})).status).toBe(401);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.test).not.toHaveBeenCalled();
  });
  it('requires waiver management authorization before any email operation', async () => {
    mocks.authorize.mockReturnValue(Effect.fail(new UnauthorizedError({message: 'Forbidden'})));
    expect((await get()).status).toBe(403);
    expect((await post({action: 'invite', templateId: id, userIds: ['member']})).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledWith('verified-session', 'waivers:manage');
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('previews without sending or allowing shared caches', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.preview).toHaveBeenCalledWith(id, actor.email, false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.test).not.toHaveBeenCalled();
  });
  it('uses only the authenticated administrative identity for a test', async () => {
    expect(
      (await post({action: 'test', templateId: id, requestId: id, reminder: true})).status,
    ).toBe(200);
    expect(mocks.test).toHaveBeenCalledWith(id, actor, id, true);
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.test.mockClear();
    expect(
      (await post({action: 'test', templateId: id, requestId: id, to: 'other@example.test'}))
        .status,
    ).toBe(400);
    expect(mocks.test).not.toHaveBeenCalled();
  });
  it('rejects missing selection and unconfirmed reminders before sending', async () => {
    expect((await post({templateId: id})).status).toBe(400);
    expect(
      (
        await post({
          action: 'remind',
          templateId: id,
          recipients: [{userId: 'member', previousEmailId: id}],
        })
      ).status,
    ).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
    const input = {action: 'invite', templateId: id, userIds: ['member']};
    expect((await post(input)).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(id, actor.uid, actor.email, input);
  });
});

import {Effect} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const fixture = vi.hoisted(() => ({
  auth: {currentUser: null as null | {email: string; getIdToken: () => Promise<string>}},
  createAccount: vi.fn(),
  createSessionCookie: vi.fn(),
}));
vi.mock('@/src/utils/firebase', () => ({auth: fixture.auth}));
vi.mock('@/src/lib/effect/client-signup', () => ({createAccount: fixture.createAccount}));
vi.mock('@/src/lib/effect/client-auth', () => ({createSessionCookie: fixture.createSessionCookie}));

import {joinAndCheckout, type JoinRequest} from '@/src/lib/effect/client-join';

const request: JoinRequest = {
  email: 'rider@example.test',
  password: 'synthetic-password',
  priceId: 'price_test',
  successUrl: 'https://club.example/member',
  cancelUrl: 'https://club.example/renew',
  coverFees: false,
  planPrice: 50,
  waivers: ['first', 'second'].map((templateId) => ({
    templateId,
    signature: {
      signerRole: 'household',
      signerName: 'Alex Rider',
      signerBirthDate: '1980-01-01',
      familyMembers: [{name: 'Sam Rider', birthDate: '2015-01-01'}],
      phone: '555-555-0100',
      addressStreet: '1 Test St',
      addressCity: 'Jacksonville',
      addressState: 'NC',
      addressZip: '28540',
      signatureText: 'Alex Rider',
      consent: true,
    },
  })),
};
const calls: string[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  fixture.auth.currentUser = null;
  fixture.createAccount.mockImplementation(() =>
    Effect.sync(() => {
      fixture.auth.currentUser = {email: request.email, getIdToken: async () => 'synthetic-token'};
      return {uid: 'synthetic-uid', email: request.email};
    }),
  );
  fixture.createSessionCookie.mockImplementation(() =>
    Effect.sync(() => {
      calls.push('session');
      return {success: true};
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      return Response.json(
        url === '/api/checkout' ? {url: 'https://checkout.example/test'} : {success: true},
      );
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('new-member waiver orchestration', () => {
  it('saves every required form after session creation and before checkout', async () => {
    expect(await Effect.runPromise(joinAndCheckout(request))).toEqual({
      checkoutUrl: 'https://checkout.example/test',
    });
    expect(calls).toEqual([
      '/api/auth/signup',
      'session',
      '/api/member/waivers/first/sign',
      '/api/member/waivers/second/sign',
      '/api/checkout',
    ]);
  });

  it('resumes with the authenticated account after a failed signature without creating it twice', async () => {
    vi.mocked(fetch)
      .mockImplementationOnce(async () => Response.json({success: true}))
      .mockImplementationOnce(async () =>
        Response.json({error: 'Temporary signing failure'}, {status: 503}),
      );
    await expect(Effect.runPromise(joinAndCheckout(request))).rejects.toThrow(
      'Temporary signing failure',
    );
    expect(calls).not.toContain('/api/checkout');
    await Effect.runPromise(joinAndCheckout(request));
    expect(fixture.createAccount).toHaveBeenCalledTimes(1);
    expect(calls.at(-1)).toBe('/api/checkout');
  });
});

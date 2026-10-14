import {Effect} from 'effect';
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('@/src/utils/firebase', () => ({auth: {currentUser: null}}));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
}));
import {
  clearSessionCookie,
  createSessionCookie,
  getPostLoginRedirectPath,
} from '@/src/lib/effect/client-auth';

afterEach(() => vi.unstubAllGlobals());

describe('login-to-waiver recovery', () => {
  it.each([
    {role: 'member', membership: null, pending: true, expected: '/waivers?returnTo=%2Frenew'},
    {
      role: 'member',
      membership: {status: 'expired'},
      pending: true,
      expected: '/waivers?returnTo=%2Frenew',
    },
    {
      role: 'member',
      membership: {status: 'active'},
      pending: true,
      expected: '/waivers?returnTo=%2Fmember',
    },
    {role: 'member', membership: null, pending: false, expected: '/renew'},
    {role: 'member', membership: {status: 'active'}, pending: false, expected: '/member'},
    {role: 'admin', membership: null, pending: true, expected: '/waivers?returnTo=%2Fdashboard'},
    {
      role: 'organizer',
      membership: null,
      pending: true,
      expected: '/waivers?returnTo=%2Fdashboard',
    },
    {role: 'admin', membership: null, pending: false, expected: '/dashboard'},
  ])(
    'routes $role with membership $membership and pending=$pending to $expected',
    async ({role, membership, pending, expected}) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url === '/api/admin/check') return Response.json({role});
          if (url === '/api/member/waivers')
            return Response.json({
              hasPendingRequired: pending,
              needsMembership: !membership || membership.status === 'expired',
            });
          throw new Error('Unexpected request');
        }),
      );
      expect(await Effect.runPromise(getPostLoginRedirectPath())).toBe(expected);
    },
  );

  it('preserves a dedicated household-signing link for staff rather than opening the dashboard', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      await Effect.runPromise(getPostLoginRedirectPath('/waivers?household=1&returnTo=%2Frenew')),
    ).toBe('/waivers?household=1&returnTo=%2Frenew');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('repairs a missing database profile before establishing a returning member’s session', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return Response.json({success: true});
      }),
    );
    await Effect.runPromise(createSessionCookie('synthetic-id-token'));
    expect(calls).toEqual(['/api/auth/signup', '/api/auth/session']);
  });

  it('does not claim login succeeded when profile recovery fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({error: 'Unavailable'}, {status: 503}));
    vi.stubGlobal('fetch', fetcher);
    await expect(Effect.runPromise(createSessionCookie('synthetic-id-token'))).rejects.toThrow(
      'prepare your member account',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('finishes a slow cookie creation before switching accounts and signing out', async () => {
    const firstResponse = Promise.withResolvers<Response>();
    const firstStarted = Promise.withResolvers<void>();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        const token = options.body ? JSON.parse(String(options.body)).idToken : 'logout';
        calls.push(`${url}/${token}`);
        if (url === '/api/auth/session' && token === 'first') {
          firstStarted.resolve();
          return firstResponse.promise;
        }
        return Response.json({success: true});
      }),
    );
    const first = Effect.runPromise(createSessionCookie('first'));
    await firstStarted.promise;
    const second = Effect.runPromise(createSessionCookie('second'));
    const logout = Effect.runPromise(clearSessionCookie());
    expect(calls).toEqual(['/api/auth/signup/first', '/api/auth/session/first']);
    firstResponse.resolve(Response.json({success: true}));
    await Promise.all([first, second, logout]);
    expect(calls).toEqual([
      '/api/auth/signup/first',
      '/api/auth/session/first',
      '/api/auth/signup/second',
      '/api/auth/session/second',
      '/api/auth/session/logout',
    ]);
  });
});

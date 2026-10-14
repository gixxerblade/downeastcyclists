import {QueryClient, QueryObserver} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {memberWaiversQueryKey, memberWaiversQueryOptions} from '@/src/lib/waivers/client';
import {
  loginReturnPathFromUrl,
  safeLoginReturnPath,
  waiverReturnPath,
} from '@/src/lib/waivers/navigation';

afterEach(() => vi.unstubAllGlobals());

describe('private waiver cache', () => {
  it('fetches the second account without exposing the first account’s cached household', async () => {
    const client = new QueryClient({
      defaultOptions: {queries: {staleTime: 300000, refetchOnMount: false, retry: false}},
    });
    client.setQueryData(memberWaiversQueryKey('account-a'), {
      userId: 'account-a',
      waivers: [{participants: [{name: 'Private child', birthDate: '2015-01-01'}]}],
    });
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        userId: 'account-b',
        requireHousehold: false,
        waivers: [],
        hasPendingRequired: true,
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const observer = new QueryObserver(client, memberWaiversQueryOptions('account-b'));
    const seen: unknown[] = [];
    const unsubscribe = observer.subscribe((result) => seen.push(result.data));
    await observer.refetch();
    expect(fetcher).toHaveBeenCalled();
    expect(JSON.stringify(seen)).not.toContain('Private child');
    expect(observer.getCurrentResult().data?.userId).toBe('account-b');
    unsubscribe();
    client.clear();
  });

  it('rejects an account/session mismatch instead of caching another person’s data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({userId: 'other-account', requireHousehold: true, waivers: []}),
        ),
    );
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    await expect(client.fetchQuery(memberWaiversQueryOptions('expected-account'))).rejects.toThrow(
      'sign in again',
    );
    expect(client.getQueryData(memberWaiversQueryKey('expected-account'))).toBeUndefined();
    client.clear();
  });
});

describe('waiver sign-in navigation', () => {
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/admin/delete',
    'javascript:alert(1)',
  ])('rejects unsafe return destinations: %s', (url) => {
    expect(safeLoginReturnPath(url)).toBeUndefined();
  });
  it('preserves household and requested waiver through a magic link on another device', () => {
    const returnTo = '/waivers?household=1&templateId=example&returnTo=%2Frenew';
    const continuation = `https://club.example/auth-handler?returnTo=${encodeURIComponent(returnTo)}`;
    const magicLink = `https://club.example/verify?mode=signIn&continueUrl=${encodeURIComponent(continuation)}`;
    expect(loginReturnPathFromUrl(magicLink)).toBe(returnTo);
    expect(waiverReturnPath('//evil.example')).toBe('/member');
  });
});

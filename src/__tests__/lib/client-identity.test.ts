import {NextRequest} from 'next/server';
import {describe, expect, it} from 'vitest';

import {getTrustedClientIdentifier} from '@/src/lib/api/client-identity';

describe('checkout client identity', () => {
  it('prefers Netlify client identity over forwarded headers', () => {
    const request = new NextRequest('https://example.com/api/checkout', {
      headers: {
        'x-nf-client-connection-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.4, 198.51.100.5',
      },
    });

    expect(getTrustedClientIdentifier(request)).toBe('ip:203.0.113.10');
  });

  it('uses a bounded fallback when no proxy identity is present', () => {
    const request = new NextRequest('https://example.com/api/checkout', {
      headers: {'user-agent': 'a'.repeat(300)},
    });

    expect(getTrustedClientIdentifier(request)).toBe(`fallback:${'a'.repeat(256)}`);
  });
});

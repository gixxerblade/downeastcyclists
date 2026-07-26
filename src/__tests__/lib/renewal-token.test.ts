import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createRenewalToken, verifyRenewalToken} from '@/src/lib/renewal-token';

const TEST_SECRET = 'renewal-token-test-secret-with-more-than-32-characters';

describe('renewal tokens', () => {
  beforeEach(() => {
    process.env.RENEWAL_LINK_SECRET = TEST_SECRET;
    process.env.RENEWAL_LINK_TTL_DAYS = '30';
  });

  afterEach(() => {
    delete process.env.RENEWAL_LINK_TTL_DAYS;
    process.env.RENEWAL_LINK_SECRET = TEST_SECRET;
  });

  it('round-trips a signed member identity', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const token = createRenewalToken('member_123', issuedAt);

    expect(verifyRenewalToken(token, new Date('2026-01-15T00:00:00.000Z'))).toEqual({
      ok: true,
      payload: {
        v: 1,
        sub: 'member_123',
        iat: Math.floor(issuedAt.getTime() / 1000),
        exp: Math.floor(issuedAt.getTime() / 1000) + 30 * 24 * 60 * 60,
      },
    });
  });

  it('rejects tampering and expired links', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const token = createRenewalToken('member_123', issuedAt);
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    expect(verifyRenewalToken(tampered, new Date('2026-01-02T00:00:00.000Z'))).toEqual({
      ok: false,
    });
    expect(verifyRenewalToken(token, new Date('2026-02-01T00:00:00.000Z'))).toEqual({
      ok: false,
    });
  });

  it('requires a strong server-side secret', () => {
    process.env.RENEWAL_LINK_SECRET = 'too-short';

    expect(() => createRenewalToken('member_123')).toThrow(/at least 32 characters/);
  });
});

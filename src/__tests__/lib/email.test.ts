import {describe, expect, it} from 'vitest';

import {normalizeEmail} from '@/src/lib/email';

describe('normalizeEmail', () => {
  it('trims and lowercases email addresses', () => {
    expect(normalizeEmail('  Member.Name@Example.COM  ')).toBe('member.name@example.com');
  });
});

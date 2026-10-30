import {describe, expect, it} from 'vitest';

import {isJerseyPreorderActive} from '@/src/lib/promotions/jersey-preorder';

describe('MTB jersey preorder deadline', () => {
  it('keeps preorders visible through the final second of November 15 in Eastern time', () => {
    expect(isJerseyPreorderActive(Date.parse('2026-11-15T23:59:59.999-05:00'))).toBe(true);
  });

  it('expires at midnight Eastern on November 16', () => {
    expect(isJerseyPreorderActive(Date.parse('2026-11-16T05:00:00Z'))).toBe(false);
    expect(isJerseyPreorderActive(Date.parse('2026-11-17T12:00:00Z'))).toBe(false);
  });

  it('stays visible when it is already November 16 in UTC but still November 15 in NC', () => {
    expect(isJerseyPreorderActive(Date.parse('2026-11-16T02:00:00Z'))).toBe(true);
  });
});

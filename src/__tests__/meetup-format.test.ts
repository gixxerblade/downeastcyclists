import {describe, expect, it} from 'vitest';

import {formatRideDateBadge, formatRideMeta} from '@/src/lib/meetup/format';

describe('Eastern ride formatting', () => {
  it('shows the Stella ride at 10 a.m., with its location', () => {
    expect(formatRideMeta(new Date('2026-11-15T15:00:00Z'), 'Stella Store')).toBe(
      'Sun, Nov 15, 10:00 AM · Stella Store',
    );
  });

  it.each([
    ['2026-03-08T06:30:00Z', 'Sun, Mar 8, 1:30 AM'],
    ['2026-03-08T07:30:00Z', 'Sun, Mar 8, 3:30 AM'],
    ['2026-11-01T05:30:00Z', 'Sun, Nov 1, 1:30 AM'],
    ['2026-11-01T06:30:00Z', 'Sun, Nov 1, 1:30 AM'],
    ['2026-07-15T14:00:00Z', 'Wed, Jul 15, 10:00 AM'],
  ])('handles daylight saving time for %s', (timestamp, expected) => {
    expect(formatRideMeta(new Date(timestamp), null)).toBe(expected);
  });

  it('keeps badge and metadata on the Eastern date across UTC midnight', () => {
    const date = new Date('2026-12-01T00:30:00Z');
    expect(formatRideMeta(date, null)).toBe('Mon, Nov 30, 7:30 PM');
    expect(formatRideDateBadge(date)).toEqual({weekday: 'Mon', day: '30', month: 'Nov'});
  });
});

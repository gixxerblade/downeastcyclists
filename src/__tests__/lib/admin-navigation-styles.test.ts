import {describe, expect, it} from 'vitest';

import {
  mobileAdminNavigationButtonSx,
  mobileAdminNavigationSx,
} from '@/src/components/admin/adminNavigationStyles';

describe('mobile admin navigation styles', () => {
  it('keeps section buttons intact inside a horizontally scrollable menu', () => {
    expect(mobileAdminNavigationSx.overflowX).toBe('auto');
    expect(mobileAdminNavigationButtonSx.flexShrink).toBe(0);
    expect(mobileAdminNavigationButtonSx.whiteSpace).toBe('nowrap');
  });
});

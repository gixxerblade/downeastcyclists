import {afterEach, describe, expect, it, vi} from 'vitest';

import {TRAIL_MAINTENANCE_TURNSTILE_ACTION} from '@/src/lib/trail-maintenance/constants';
import {verifyTrailMaintenanceTurnstile} from '@/src/lib/trail-maintenance/turnstile';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  delete process.env.CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES;
});

describe('trail maintenance Turnstile verification', () => {
  it('accepts the expected action and hostname', async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'turnstile-secret';
    process.env.CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES = 'downeastcyclists.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          action: TRAIL_MAINTENANCE_TURNSTILE_ACTION,
          hostname: 'downeastcyclists.com',
        }),
      ),
    );

    await expect(
      verifyTrailMaintenanceTurnstile({token: 'valid-token', remoteIp: '192.0.2.1'}),
    ).resolves.toEqual({ok: true});
  });

  it('rejects a token issued for a different action', async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'turnstile-secret';
    process.env.CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES = 'downeastcyclists.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          action: 'different_action',
          hostname: 'downeastcyclists.com',
        }),
      ),
    );

    await expect(
      verifyTrailMaintenanceTurnstile({token: 'valid-token', remoteIp: null}),
    ).resolves.toEqual({ok: false, reason: 'Turnstile action is not allowed'});
  });
});

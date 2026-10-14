import {Effect} from 'effect';
import {afterEach, describe, expect, it, vi} from 'vitest';
const send = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({
  Resend: class {
    emails = {send};
  },
}));
import {EmailService, EmailServiceLive} from '@/src/lib/effect/email.service';

afterEach(() => vi.unstubAllEnvs());

describe('waiver email configuration', () => {
  it('fails both preflight and direct sending when the API key is absent', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* EmailService;
        const configured = yield* Effect.either(service.ensureWaiverEmailConfigured());
        const sent = yield* Effect.either(
          service.sendWaiverSignatureRequestEmail({
            to: 'recipient@example.test',
            name: 'Test',
            waiverTitle: 'Waiver',
            signUrl: 'https://club.example/waivers',
            idempotencyKey: 'test',
          }),
        );
        return {configured, sent};
      }).pipe(Effect.provide(EmailServiceLive)),
    );
    expect(result.configured._tag).toBe('Left');
    expect(result.sent._tag).toBe('Left');
    expect(send).not.toHaveBeenCalled();
  });
  it('propagates provider failures instead of claiming successful delivery', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_synthetic_key');
    send.mockResolvedValue({
      data: null,
      error: {name: 'validation_error', message: 'Invalid sender'},
    });
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* EmailService;
          yield* service.sendWaiverSignatureRequestEmail({
            to: 'recipient@example.test',
            name: 'Test',
            waiverTitle: 'Waiver',
            signUrl: 'https://club.example/waivers',
            idempotencyKey: 'test',
          });
        }).pipe(Effect.provide(EmailServiceLive)),
      ),
    ).rejects.toThrow('Invalid sender');
  });
});

import {Effect} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const send = vi.hoisted(() => vi.fn());
const getTemplate = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({
  Resend: class {
    emails = {send};
    templates = {get: getTemplate};
  },
}));
import {EmailService, EmailServiceLive} from '@/src/lib/effect/email.service';

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => vi.clearAllMocks());

const input = {
  to: 'recipient@example.test',
  name: '<Alex & Sam>',
  waiverTitle: 'Club waiver',
  signUrl: 'https://club.example/waivers?templateId=test',
  idempotencyKey: 'test',
};

function runWithEmail<A, E>(program: (service: EmailService) => Effect.Effect<A, E>) {
  return Effect.runPromise(
    Effect.flatMap(EmailService, program).pipe(Effect.provide(EmailServiceLive)),
  );
}

describe('waiver email configuration', () => {
  it('uses the hosted template and the same variables for invitations, reminders, and tests', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_synthetic_key');
    send.mockResolvedValue({data: {id: 'synthetic'}, error: null});
    await runWithEmail((email) =>
      email.sendWaiverSignatureRequestEmail({...input, reminder: true, test: true}),
    );
    expect(send).toHaveBeenCalledWith(
      {
        from: expect.any(String),
        to: input.to,
        subject: '[TEST] Reminder: sign your Down East Cyclists liability waiver',
        template: {
          id: 'liability-waiver-invitation',
          variables: {
            MEMBER_NAME: input.name,
            WAIVER_TITLE: input.waiverTitle,
            SIGN_URL: input.signUrl,
            INTRO: expect.stringContaining('friendly reminder'),
            MEMBER_NAME_HTML: '&lt;Alex &amp; Sam&gt;',
            WAIVER_TITLE_HTML: input.waiverTitle,
            SIGN_URL_HTML: input.signUrl,
            INTRO_HTML: expect.stringContaining('friendly reminder'),
          },
        },
      },
      {idempotencyKey: 'test'},
    );
    expect(send.mock.calls[0][0]).not.toHaveProperty('html');
  });
  it('loads the published template for preview, escapes variables, and never sends', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_synthetic_key');
    getTemplate.mockResolvedValue({
      data: {
        status: 'published',
        has_unpublished_versions: false,
        html: '<p>{{{MEMBER_NAME_HTML}}}</p><a href="{{{SIGN_URL_HTML}}}">Sign</a>',
        text: 'Hi {{{MEMBER_NAME}}}',
        variables: [],
      },
      error: null,
    });
    const preview = await runWithEmail((email) => email.previewWaiverSignatureRequestEmail(input));
    expect(preview.html).toContain('&lt;Alex &amp; Sam&gt;');
    expect(preview.text).toBe('Hi <Alex & Sam>');
    expect(send).not.toHaveBeenCalled();
  });
  it('does not show unpublished draft content as the outgoing email', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_synthetic_key');
    getTemplate.mockResolvedValue({
      data: {status: 'published', has_unpublished_versions: true},
      error: null,
    });
    await expect(
      runWithEmail((email) => email.previewWaiverSignatureRequestEmail(input)),
    ).rejects.toThrow('Publish the latest');
  });
  it('explains when a sending-only key cannot read templates, without blocking a test send', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_synthetic_key');
    getTemplate.mockResolvedValue({data: null, error: {message: 'restricted_api_key'}});
    await expect(
      runWithEmail((email) => email.previewWaiverSignatureRequestEmail(input)),
    ).rejects.toThrow('RESEND_TEMPLATE_API_KEY');
    send.mockResolvedValue({data: {id: 'synthetic'}, error: null});
    await runWithEmail((email) => email.sendWaiverSignatureRequestEmail({...input, test: true}));
    expect(send).toHaveBeenCalledTimes(1);
  });
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

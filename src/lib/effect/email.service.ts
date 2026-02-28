import {Context, Effect, Layer} from 'effect';
import {Resend} from 'resend';

import {EmailError} from './errors';

export interface EmailService {
  readonly sendWelcomeEmail: (params: {
    to: string;
    name: string | undefined;
    passwordSetupLink: string;
  }) => Effect.Effect<void, EmailError>;
}

export const EmailService = Context.GenericTag<EmailService>('EmailService');

const make = Effect.gen(function* () {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    yield* Effect.logWarning('RESEND_API_KEY not set — welcome emails will not be sent');
  }

  const resend = apiKey ? new Resend(apiKey) : null;
  const from = process.env.EMAIL_FROM ?? 'Down East Cyclists <noreply@downeastcyclists.com>';

  return EmailService.of({
    sendWelcomeEmail: ({to, name, passwordSetupLink}) =>
      Effect.gen(function* () {
        if (!resend) {
          yield* Effect.logWarning(
            `Skipping welcome email to ${to}: RESEND_API_KEY not configured`,
          );
          return;
        }

        const displayName = name ?? 'Member';

        yield* Effect.tryPromise({
          try: async () => {
            const {data, error} = await resend.emails.send({
              from,
              to,
              subject: 'Welcome to Down East Cyclists — Set Your Password',
              html: `
                <p>Hi ${displayName},</p>
                <p>Your Down East Cyclists membership account has been created.</p>
                <p>Click the link below to set your password and access the member portal:</p>
                <p><a href="${passwordSetupLink}">Set My Password</a></p>
                <p>This link expires in 24 hours. If you need a new one, use the
                   "Forgot password?" option on the sign-in page.</p>
                <p>— Down East Cyclists</p>
              `.trim(),
            });
            if (error) {
              throw error;
            }
            return data;
          },
          catch: (error) => {
            const detail =
              error instanceof Error
                ? error.message
                : typeof error === 'object' && error !== null && 'message' in error
                  ? String((error as {message: unknown}).message)
                  : JSON.stringify(error);
            console.error('[EmailService] Resend error:', error);
            return new EmailError({
              code: 'SEND_FAILED',
              message: `Failed to send welcome email to ${to}: ${detail}`,
              cause: error,
            });
          },
        });
      }),
  });
});

export const EmailServiceLive = Layer.effect(EmailService, make);

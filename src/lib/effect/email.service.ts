import {Context, Effect, Layer} from 'effect';
import {Resend} from 'resend';

import {EmailError} from './errors';

export interface EmailService {
  readonly sendWelcomeEmail: (params: {
    to: string;
    name: string | undefined;
    passwordSetupLink: string;
  }) => Effect.Effect<void, EmailError>;

  readonly sendRenewalEmail: (params: {
    to: string;
    name: string | undefined;
    renewalUrl: string;
    expirationDate: string | undefined;
    planName: string | undefined;
    daysUntilExpiration?: 30 | 60 | 90;
    idempotencyKey: string;
  }) => Effect.Effect<void, EmailError>;

  readonly sendOrganizerAccessGrantedEmail: (params: {
    to: string;
    name: string | undefined;
    loginUrl: string;
    dashboardUrl: string;
    grantedByName: string | undefined;
    supportEmail: string;
    idempotencyKey: string;
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
  const renewalTemplateId = process.env.RESEND_RENEWAL_TEMPLATE_ID;
  const organizerTemplateId =
    process.env.RESEND_ORGANIZER_ACCESS_TEMPLATE_ID ?? 'organizer-access-granted';

  const describeResendError = (error: unknown) =>
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as {message: unknown}).message)
        : JSON.stringify(error);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

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
            const {data, error} = await resend.emails.send(
              {
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
              },
              {idempotencyKey: `welcome-email/${to}`},
            );
            if (error) {
              throw error;
            }
            return data;
          },
          catch: (error) => {
            const detail = describeResendError(error);
            console.error('[EmailService] Resend error:', error);
            return new EmailError({
              code: 'SEND_FAILED',
              message: `Failed to send welcome email to ${to}: ${detail}`,
              cause: error,
            });
          },
        });
      }),

    sendRenewalEmail: ({
      to,
      name,
      renewalUrl,
      expirationDate,
      planName,
      daysUntilExpiration,
      idempotencyKey,
    }) =>
      Effect.gen(function* () {
        if (!resend) {
          yield* Effect.logWarning(
            `Skipping renewal email to ${to}: RESEND_API_KEY not configured`,
          );
          return;
        }

        const displayName = name?.trim() || 'Member';
        const formattedExpiration = expirationDate
          ? new Date(expirationDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : 'your expiration date';
        const resolvedPlanName = planName || 'Down East Cyclists membership';
        const isReminder = daysUntilExpiration !== undefined;
        const subject = isReminder
          ? `Your Down East Cyclists membership renews in ${daysUntilExpiration} days`
          : 'Renew your Down East Cyclists membership';
        const lead = isReminder
          ? `Your ${resolvedPlanName} expires on ${formattedExpiration}.`
          : `Your ${resolvedPlanName} has expired or needs renewal.`;
        const text = [
          `Hi ${displayName},`,
          '',
          lead,
          'Renew online to keep access to your member benefits and digital membership card.',
          '',
          renewalUrl,
          '',
          'Down East Cyclists',
        ].join('\n');
        const html = `
          <p>Hi ${escapeHtml(displayName)},</p>
          <p>${escapeHtml(lead)}</p>
          <p>Renew online to keep access to your member benefits and digital membership card.</p>
          <p><a href="${escapeHtml(renewalUrl)}">Renew Membership</a></p>
          <p>Down East Cyclists</p>
        `.trim();

        yield* Effect.tryPromise({
          try: async () => {
            const payload = renewalTemplateId
              ? {
                  from,
                  to,
                  subject,
                  template: {
                    id: renewalTemplateId,
                    variables: {
                      MEMBER_NAME: displayName,
                      RENEW_URL: renewalUrl,
                      EXPIRATION_DATE: formattedExpiration,
                      PLAN_NAME: resolvedPlanName,
                      DAYS_UNTIL_EXPIRATION: daysUntilExpiration ?? 0,
                    },
                  },
                }
              : {
                  from,
                  to,
                  subject,
                  html,
                  text,
                };

            const {error} = await resend.emails.send(payload, {idempotencyKey});
            if (error) {
              throw error;
            }
          },
          catch: (error) => {
            const detail = describeResendError(error);
            console.error('[EmailService] Resend renewal error:', error);
            return new EmailError({
              code: 'SEND_RENEWAL_FAILED',
              message: `Failed to send renewal email to ${to}: ${detail}`,
              cause: error,
            });
          },
        });
      }),

    sendOrganizerAccessGrantedEmail: ({
      to,
      name,
      loginUrl,
      dashboardUrl,
      grantedByName,
      supportEmail,
      idempotencyKey,
    }) =>
      Effect.gen(function* () {
        if (!resend) {
          yield* Effect.logWarning(
            `Skipping organizer access email to ${to}: RESEND_API_KEY not configured`,
          );
          return;
        }

        const displayName = name?.trim() || 'there';
        const actorName = grantedByName?.trim() || 'a site administrator';
        const subject = 'You now have organizer access to Down East Cyclists';
        const text = [
          `Hi ${displayName},`,
          '',
          `You have been granted organizer access to Down East Cyclists by ${actorName}.`,
          '',
          'Sign in with your member account:',
          loginUrl,
          '',
          'After signing in, open the organizer dashboard:',
          dashboardUrl,
          '',
          'As an organizer, you can view membership reports, export member data, send password reset emails, refresh membership stats, and update trail status information.',
          '',
          `Use ${to} when signing in. If you do not have a password or prefer not to use one, choose the email sign-in link option on the login page.`,
          '',
          `If you believe you received this by mistake or need help accessing the dashboard, contact ${supportEmail}.`,
          '',
          'Down East Cyclists',
        ].join('\n');

        const html = `
          <p>Hi ${escapeHtml(displayName)},</p>
          <p>You have been granted organizer access to Down East Cyclists by ${escapeHtml(actorName)}.</p>
          <p><a href="${escapeHtml(loginUrl)}">Sign in to your account</a></p>
          <p>After signing in, open the organizer dashboard:</p>
          <p><a href="${escapeHtml(dashboardUrl)}">Open organizer dashboard</a></p>
          <p>As an organizer, you can view membership reports, export member data, send password reset emails, refresh membership stats, and update trail status information.</p>
          <p>Use ${escapeHtml(to)} when signing in. If you do not have a password or prefer not to use one, choose the email sign-in link option on the login page.</p>
          <p>If you believe you received this by mistake or need help accessing the dashboard, contact ${escapeHtml(supportEmail)}.</p>
          <p>Down East Cyclists</p>
        `.trim();

        yield* Effect.tryPromise({
          try: async () => {
            const {error} = await resend.emails.send(
              {
                from,
                to,
                subject,
                template: {
                  id: organizerTemplateId,
                  variables: {
                    USER_NAME: displayName,
                    USER_EMAIL: to,
                    ORG_NAME: 'Down East Cyclists',
                    LOGIN_URL: loginUrl,
                    DASHBOARD_URL: dashboardUrl,
                    GRANTED_BY_NAME: actorName,
                    SUPPORT_EMAIL: supportEmail,
                  },
                },
              },
              {idempotencyKey},
            );
            if (error) {
              throw error;
            }
          },
          catch: (error) => {
            const detail = describeResendError(error);
            console.error('[EmailService] Resend organizer access error:', error);
            return new EmailError({
              code: 'SEND_ORGANIZER_ACCESS_FAILED',
              message: `Failed to send organizer access email to ${to}: ${detail}`,
              cause: error,
            });
          },
        }).pipe(
          Effect.catchTag('EmailError', (templateError) =>
            Effect.gen(function* () {
              yield* Effect.logWarning(
                `Template organizer access email failed for ${to}; trying inline fallback: ${templateError.message}`,
              );
              yield* Effect.tryPromise({
                try: async () => {
                  const {error} = await resend.emails.send(
                    {
                      from,
                      to,
                      subject,
                      html,
                      text,
                    },
                    {idempotencyKey: `${idempotencyKey}/inline`},
                  );
                  if (error) {
                    throw error;
                  }
                },
                catch: (error) => {
                  const detail = describeResendError(error);
                  console.error('[EmailService] Resend organizer access fallback error:', error);
                  return new EmailError({
                    code: 'SEND_ORGANIZER_ACCESS_FAILED',
                    message: `Failed to send organizer access email to ${to}: ${detail}`,
                    cause: error,
                  });
                },
              });
            }),
          ),
        );
      }),
  });
});

export const EmailServiceLive = Layer.effect(EmailService, make);

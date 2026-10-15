export const WAIVER_EMAIL_TYPE = 'liability_waiver_signature_request';
export const WAIVER_EMAIL_TEMPLATE = 'liability-waiver-invitation';
export const WAIVER_EMAIL_BATCH_SIZE = 20;

export interface WaiverEmailContent {
  name?: string;
  waiverTitle: string;
  signUrl: string;
  reminder?: boolean;
  test?: boolean;
}

export function waiverEmailSubject(input: Pick<WaiverEmailContent, 'reminder' | 'test'> = {}) {
  return `${input.test ? '[TEST] ' : ''}${input.reminder ? 'Reminder' : 'Action required'}: sign your Down East Cyclists liability waiver`;
}

export function waiverEmailVariables(input: WaiverEmailContent) {
  const plain = {
    MEMBER_NAME: input.name?.trim() || 'Member',
    WAIVER_TITLE: input.waiverTitle,
    SIGN_URL: input.signUrl,
    INTRO: `${input.test ? 'This is a test for the administrator. No member has been contacted. ' : ''}${
      input.reminder
        ? 'A friendly reminder: our records show that your waiver still needs to be completed.'
        : 'We are collecting digital liability waivers for our club rides and events.'
    }`,
  };
  // Resend substitutes raw strings. Keep HTML-safe values separate from the
  // plain-text body so names cannot inject markup and text stays readable.
  return {
    ...plain,
    MEMBER_NAME_HTML: escapeHtml(plain.MEMBER_NAME),
    WAIVER_TITLE_HTML: escapeHtml(plain.WAIVER_TITLE),
    SIGN_URL_HTML: escapeHtml(plain.SIGN_URL),
    INTRO_HTML: escapeHtml(plain.INTRO),
  };
}

// Mirror Resend's plain, one-pass substitution with the same pre-escaped values.
export function renderWaiverEmailTemplate(
  source: string,
  variables: Record<string, string | number>,
) {
  return source.replace(/\{\{\{([A-Za-z0-9_]+)\}\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined) throw new Error(`Unknown email template variable: ${key}`);
    return String(value);
  });
}
import {escapeHtml} from '../html';

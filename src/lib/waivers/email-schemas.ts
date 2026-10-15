import {Schema as S} from 'effect';

import {WAIVER_EMAIL_BATCH_SIZE} from './email-content';

const userId = S.String.pipe(S.minLength(1), S.maxLength(128));
const recipients = S.Array(userId).pipe(S.minItems(1), S.maxItems(WAIVER_EMAIL_BATCH_SIZE));

export const WaiverEmailRequest = S.Union(
  S.Struct({action: S.Literal('invite'), templateId: S.UUID, userIds: recipients}),
  S.Struct({
    action: S.Literal('remind'),
    templateId: S.UUID,
    confirmed: S.Literal(true),
    recipients: S.Array(S.Struct({userId, previousEmailId: S.UUID})).pipe(
      S.minItems(1),
      S.maxItems(WAIVER_EMAIL_BATCH_SIZE),
    ),
  }),
  S.Struct({
    action: S.Literal('test'),
    templateId: S.UUID,
    requestId: S.UUID,
    reminder: S.optional(S.Boolean),
  }),
);
export type WaiverEmailRequest = S.Schema.Type<typeof WaiverEmailRequest>;

export const WaiverEmailPreview = S.Struct({
  subject: S.String,
  html: S.String,
  text: S.String,
  from: S.String,
  testRecipient: S.String,
});

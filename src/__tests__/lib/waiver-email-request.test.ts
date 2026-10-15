import {Schema as S} from 'effect';
import {describe, expect, it} from 'vitest';

import {renderWaiverEmailTemplate, WAIVER_EMAIL_BATCH_SIZE} from '@/src/lib/waivers/email-content';
import {WaiverEmailRequest} from '@/src/lib/waivers/email-schemas';

const id = '11111111-1111-4111-8111-111111111111';
const decode = (input: unknown) =>
  S.decodeUnknownSync(WaiverEmailRequest)(input, {onExcessProperty: 'error'});

describe('waiver email request boundary', () => {
  it.each([
    {templateId: id},
    {action: 'invite', templateId: id, userIds: []},
    {
      action: 'invite',
      templateId: id,
      userIds: Array.from({length: WAIVER_EMAIL_BATCH_SIZE + 1}, (_, i) => `user${i}`),
    },
    {action: 'remind', templateId: id, recipients: [{userId: 'member', previousEmailId: id}]},
    {
      action: 'remind',
      templateId: id,
      confirmed: false,
      recipients: [{userId: 'member', previousEmailId: id}],
    },
    {action: 'test', templateId: id, requestId: id, to: 'someone-else@example.test'},
  ])('rejects ambiguous, unconfirmed, or redirected requests: %j', (input) => {
    expect(() => decode(input)).toThrow();
  });
  it('accepts explicit selection, confirmed reminder, and self-test', () => {
    for (const input of [
      {action: 'invite', templateId: id, userIds: ['member']},
      {
        action: 'remind',
        templateId: id,
        confirmed: true,
        recipients: [{userId: 'member', previousEmailId: id}],
      },
      {action: 'test', templateId: id, requestId: id},
    ])
      expect(decode(input)).toEqual(input);
  });
  it('renders variables once and refuses unknown placeholders', () => {
    expect(
      renderWaiverEmailTemplate('{{{MEMBER_NAME}}}', {
        MEMBER_NAME: '{{{SIGN_URL}}}',
        SIGN_URL: 'secret',
      }),
    ).toBe('{{{SIGN_URL}}}');
    expect(() => renderWaiverEmailTemplate('{{{MISSING}}}', {})).toThrow(
      'Unknown email template variable',
    );
  });
});

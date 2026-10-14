import {Schema} from 'effect';
import {describe, expect, it} from 'vitest';

import {DEFAULT_WAIVER_CONTENT, DEFAULT_WAIVER_TITLE} from '@/src/lib/waivers/default-waiver';
import {WaiverSignatureInput, WaiverTemplateInput} from '@/src/lib/waivers/schemas';
import {validateWaiverSignature, waiverParticipants} from '@/src/lib/waivers/signature';

const adultSignature = {
  signerRole: 'adult',
  signerBirthDate: '1985-06-12',
  familyMembers: [],
  signerName: 'Alex Rider',
  phone: '910-555-0100',
  addressStreet: '123 Main Street',
  addressCity: 'Jacksonville',
  addressState: 'NC',
  addressZip: '28540',
  signatureText: 'Alex Rider',
  consent: true,
};

describe('waiver boundary schemas', () => {
  it('accepts a complete adult electronic signature', () => {
    const result = Schema.decodeUnknownEither(WaiverSignatureInput)(adultSignature);
    expect(result._tag).toBe('Right');
  });

  it('requires an affirmative electronic-signature consent', () => {
    const result = Schema.decodeUnknownEither(WaiverSignatureInput)({
      ...adultSignature,
      consent: false,
    });
    expect(result._tag).toBe('Left');
  });

  it('rejects incomplete contact evidence', () => {
    const result = Schema.decodeUnknownEither(WaiverSignatureInput)({
      ...adultSignature,
      addressStreet: '',
    });
    expect(result._tag).toBe('Left');
  });

  it('accepts a custom draft template', () => {
    const result = Schema.decodeUnknownEither(WaiverTemplateInput)({
      title: 'Annual ride waiver',
      scope: 'ride',
      content: 'Custom ride waiver terms',
      acknowledgment: 'I agree to these terms.',
      isRequired: true,
    });
    expect(result._tag).toBe('Right');
  });
});

describe('seeded LAB waiver', () => {
  it('preserves the supplied form identity and core release clauses', () => {
    expect(DEFAULT_WAIVER_TITLE).toContain('Release and Waiver');
    expect(DEFAULT_WAIVER_CONTENT).toContain('Down East Cyclists ("Club")');
    expect(DEFAULT_WAIVER_CONTENT).toContain('BICYCLING ACTIVITIES INVOLVE RISKS');
    expect(DEFAULT_WAIVER_CONTENT).toContain('MINOR RELEASE');
    expect(DEFAULT_WAIVER_CONTENT).toContain('AND I, THE MINOR');
    expect(DEFAULT_WAIVER_CONTENT).not.toContain('Membership Application');
    expect(DEFAULT_WAIVER_CONTENT).not.toContain('DME #480846');
  });
});

const now = new Date('2026-09-12T16:00:00Z');
const decode = Schema.decodeUnknownSync(WaiverSignatureInput);
const household = {
  ...adultSignature,
  signerRole: 'household',
  familyMembers: [
    {name: 'Sam Rider', birthDate: '1986-04-01'},
    {name: 'Casey Rider', birthDate: '2015-02-28'},
  ],
};

describe('one signature for a household', () => {
  it('includes the signer, another adult, and a child without requiring their signatures', () => {
    const input = decode(household);
    expect(validateWaiverSignature(input, now)).toBeNull();
    expect(waiverParticipants(input)).toEqual([
      {name: 'Alex Rider', birthDate: '1985-06-12'},
      ...household.familyMembers,
    ]);
  });

  it.each(['2025-02-29', '2015-02-30', '2020-13-01', '2027-01-01', '09/12/2000', ''])(
    'rejects invalid or future family birth date %s',
    (birthDate) => {
      const result = Schema.decodeUnknownEither(WaiverSignatureInput)({
        ...household,
        familyMembers: [{name: 'Casey Rider', birthDate}],
      });
      expect(result._tag === 'Left' || validateWaiverSignature(result.right, now) !== null).toBe(
        true,
      );
    },
  );

  it('accepts a real leap-day birthday', () => {
    expect(
      validateWaiverSignature(
        decode({...household, familyMembers: [{name: 'Casey Rider', birthDate: '2024-02-29'}]}),
        now,
      ),
    ).toBeNull();
  });

  it('rejects whitespace-only names and missing birth dates at the boundary', () => {
    expect(
      Schema.decodeUnknownEither(WaiverSignatureInput)({
        ...household,
        familyMembers: [{name: '   ', birthDate: '2010-01-01'}],
      })._tag,
    ).toBe('Left');
    expect(
      Schema.decodeUnknownEither(WaiverSignatureInput)({
        ...household,
        familyMembers: [{name: 'Casey Rider'}],
      })._tag,
    ).toBe('Left');
  });

  it('requires the household signer to be at least 18, including the birthday boundary', () => {
    expect(
      validateWaiverSignature(decode({...household, signerBirthDate: '2008-09-13'}), now),
    ).toContain('18');
    expect(
      validateWaiverSignature(decode({...household, signerBirthDate: '2008-09-12'}), now),
    ).toBeNull();
  });

  it('rejects duplicate people, including a second entry for the signer', () => {
    expect(
      validateWaiverSignature(
        decode({...household, familyMembers: [{name: '  alex   rider ', birthDate: '1985-06-12'}]}),
        now,
      ),
    ).toContain('more than once');
  });

  it('allows two people with the same name when their birth dates differ', () => {
    expect(
      validateWaiverSignature(
        decode({...household, familyMembers: [{name: 'Alex Rider', birthDate: '2010-06-12'}]}),
        now,
      ),
    ).toBeNull();
  });

  it('requires a matching signature and explicit family signing', () => {
    expect(
      validateWaiverSignature(decode({...household, signatureText: 'Someone Else'}), now),
    ).toContain('match');
    expect(validateWaiverSignature(decode({...household, signerRole: 'adult'}), now)).toContain(
      'family signing',
    );
  });

  it('rejects the superseded guardian-signing request shape', () => {
    expect(
      Schema.decodeUnknownEither(WaiverSignatureInput)({...household, signerRole: 'guardian'})._tag,
    ).toBe('Left');
  });
});

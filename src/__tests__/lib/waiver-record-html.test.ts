import {describe, expect, it} from 'vitest';

import {renderWaiverRecord, type SignedWaiverRecord} from '@/src/lib/waivers/record-html';
import {waiverConsent} from '@/src/lib/waivers/signature';

const record: SignedWaiverRecord = {
  id: 'signed-copy-id',
  waiverTemplateId: 'template-id',
  userId: 'owner-id',
  revision: 2,
  signerRole: 'household',
  participants: [
    {name: 'Alex Rider', birthDate: '1985-01-01'},
    {name: 'Sam Rider', birthDate: '2015-07-10'},
  ],
  participantName: 'Alex Rider',
  participantBirthDate: '1985-01-01',
  participantSignatureText: 'Alex Rider',
  guardianName: null,
  signerName: 'Alex Rider',
  signerEmail: 'alex@example.test',
  phone: '555-555-0100',
  addressStreet: '1 Main St',
  addressCity: 'Jacksonville',
  addressState: 'NC',
  addressZip: '28540',
  templateTitle: 'Club waiver',
  templateVersion: 2,
  termsSnapshot: 'The exact signed terms.',
  acknowledgmentSnapshot: 'I read this waiver.',
  signatureText: 'Alex Rider',
  consentText: waiverConsent('household'),
  documentDigest: 'digest',
  ipAddressHash: null,
  userAgent: null,
  signedAt: '2026-09-12T15:00:00.000Z',
};

describe('printable signed waiver', () => {
  it('prints every family member’s birth date and one household signature', () => {
    const html = renderWaiverRecord(record);
    expect(html).toContain('<td>Alex Rider</td><td>1985-01-01</td>');
    expect(html).toContain('<td>Sam Rider</td><td>2015-07-10</td>');
    expect(html).toContain('Signed by head of household / initial member');
    expect(html).toContain('every family member listed above');
    expect(html).toContain('Version 2 · Copy 2');
    expect(html).toContain('The exact signed terms.');
    expect(html).toContain('Print or save as PDF');
    expect(html.match(/<strong>Electronic signature:/g)).toHaveLength(1);
    expect(html).not.toContain('Minor electronic signature');
  });

  it('escapes names and stored content instead of treating them as markup', () => {
    const html = renderWaiverRecord({
      ...record,
      participants: [{name: '<script>alert(1)</script>', birthDate: '2015-07-10'}],
      termsSnapshot: '<img src=x onerror=alert(1)>',
      signerName: 'Alex & Sam',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Alex &amp; Sam');
  });

  it('preserves older guardian records without representing them as household signatures', () => {
    const html = renderWaiverRecord({
      ...record,
      signerRole: 'guardian',
      participants: [],
      guardianName: 'Alex Rider',
      participantName: 'Sam Rider',
      participantBirthDate: '2015-07-10',
      participantSignatureText: 'Sam Rider',
    });
    expect(html).toContain('Minor participant:</strong> Sam Rider');
    expect(html).toContain('Parent/guardian:</strong> Alex Rider');
    expect(html).not.toContain('Signed by head of household');
  });
});

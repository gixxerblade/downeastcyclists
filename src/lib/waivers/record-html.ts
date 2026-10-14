import type {waiverSignatures} from '@/src/db/schema/tables';

export type SignedWaiverRecord = Omit<typeof waiverSignatures.$inferSelect, 'signedAt'> & {
  signedAt: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderWaiverRecord(result: SignedWaiverRecord): string {
  const minorDetails =
    result.signerRole === 'guardian'
      ? `<div><strong>Minor participant:</strong> ${escapeHtml(result.participantName)}</div>
         <div><strong>Minor birth date:</strong> ${escapeHtml(result.participantBirthDate ?? '')}</div>
         <div><strong>Minor electronic signature:</strong> ${escapeHtml(result.participantSignatureText)}</div>
         <div><strong>Parent/guardian:</strong> ${escapeHtml(result.guardianName ?? '')}</div>`
      : `<div><strong>Participant:</strong> ${escapeHtml(result.participantName)}</div>`;
  const roster = result.participants.length
    ? `<section><h2>${result.signerRole === 'household' ? 'Family members included in this waiver' : 'Participant'}</h2>
      <table><thead><tr><th scope="col">Full name</th><th scope="col">Birth date</th></tr></thead><tbody>
      ${result.participants.map((person) => `<tr><td>${escapeHtml(person.name)}</td><td>${escapeHtml(person.birthDate)}</td></tr>`).join('')}
      </tbody></table></section>`
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(result.templateTitle)} - Signed record</title>
  <style>
    body { color: #171717; font: 14px/1.55 Arial, sans-serif; margin: 0; }
    main { margin: 32px auto; max-width: 850px; padding: 0 24px 48px; }
    h1 { font-size: 25px; line-height: 1.2; margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 24px; }
    .terms { border: 1px solid #bbb; padding: 24px; white-space: pre-wrap; }
    .signature { border-top: 2px solid #111; margin-top: 28px; padding-top: 18px; }
    .signature div { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; } th, td { text-align: left; border: 1px solid #bbb; padding: 8px; } tr { break-inside: avoid; } thead { display: table-header-group; }
    .digest { color: #555; font-family: monospace; font-size: 11px; overflow-wrap: anywhere; }
    button { background: #d71920; border: 0; color: white; cursor: pointer; font-weight: bold; padding: 11px 18px; }
    @media print { button { display: none; } main { margin: 0 auto; } }
  </style>
</head>
<body>
  <main>
    <button type="button" onclick="window.print()">Print or save as PDF</button>
    <h1>${escapeHtml(result.templateTitle)}</h1>
    <div class="meta">Version ${result.templateVersion} · Copy ${result.revision} · Signed ${escapeHtml(
      new Date(result.signedAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      }),
    )}</div>
    <section class="terms">${escapeHtml(result.termsSnapshot)}</section>
    ${roster}
    <section class="signature">
      ${result.signerRole === 'household' ? '<div><strong>Signed by head of household / initial member</strong></div>' : minorDetails}
      <div><strong>Signer:</strong> ${escapeHtml(result.signerName)}</div>
      <div><strong>Email:</strong> ${escapeHtml(result.signerEmail)}</div>
      <div><strong>Phone:</strong> ${escapeHtml(result.phone)}</div>
      <div><strong>Address:</strong> ${escapeHtml(
        `${result.addressStreet}, ${result.addressCity}, ${result.addressState} ${result.addressZip}`,
      )}</div>
      <p><strong>Acknowledgment:</strong> ${escapeHtml(result.acknowledgmentSnapshot)}</p>
      <p><strong>Signing statement:</strong> ${escapeHtml(result.consentText)}</p>
      <p><strong>Electronic signature:</strong> ${escapeHtml(result.signatureText)}</p>
      <p>Record ID: ${escapeHtml(result.id)}</p>
      <p class="digest">Record digest: ${escapeHtml(result.documentDigest)}</p>
    </section>
  </main>
</body>
</html>`;

  return html;
}

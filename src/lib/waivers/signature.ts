import type {WaiverFamilyMember, WaiverSignatureInput} from './schemas';

export const HOUSEHOLD_SIGNATURE_CONSENT =
  'I am the head of household or initial member, I am 18 or older, and I am signing this waiver on behalf of myself and every family member listed above. I confirm that the names and birth dates are complete and accurate.';

export const ELECTRONIC_SIGNATURE_CONSENT =
  'I consent to transact electronically and intend my typed name to be my electronic signature for this waiver.';

export const normalizeWaiverName = (value: string) => value.trim().replaceAll(/\s+/g, ' ');

export function waiverConsent(signerRole: 'adult' | 'household'): string {
  return signerRole === 'household'
    ? `${HOUSEHOLD_SIGNATURE_CONSENT} ${ELECTRONIC_SIGNATURE_CONSENT}`
    : ELECTRONIC_SIGNATURE_CONSENT;
}

export function waiverParticipants(input: WaiverSignatureInput): WaiverFamilyMember[] {
  return [
    {name: normalizeWaiverName(input.signerName), birthDate: input.signerBirthDate},
    ...input.familyMembers.map((member) => ({
      name: normalizeWaiverName(member.name),
      birthDate: member.birthDate,
    })),
  ];
}

export function validBirthDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' &&
    value <= now.toISOString().slice(0, 10)
  );
}

export function validateWaiverSignature(
  input: WaiverSignatureInput,
  now = new Date(),
): string | null {
  if (!input.consent) return 'Please agree to the waiver and electronic signature statement.';
  if (
    normalizeWaiverName(input.signerName).toLowerCase() !==
    normalizeWaiverName(input.signatureText).toLowerCase()
  ) {
    return 'Your electronic signature must match your full name.';
  }
  if (!validBirthDate(input.signerBirthDate, now))
    return 'Enter a valid birth date for the signer.';
  const birth = new Date(`${input.signerBirthDate}T00:00:00Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())
  )
    age -= 1;
  if (age < 18) return 'The person signing must be 18 or older.';
  if (input.signerRole === 'adult' && input.familyMembers.length)
    return 'Select family signing to include family members.';
  const participants = waiverParticipants(input);
  const seen = new Set<string>();
  for (const member of participants) {
    if (!member.name || !validBirthDate(member.birthDate, now))
      return 'Enter a full name and valid birth date for every family member.';
    const identity = `${member.name.toLowerCase()}|${member.birthDate}`;
    if (seen.has(identity))
      return 'A family member is listed more than once. Include each person only once.';
    seen.add(identity);
  }
  return null;
}

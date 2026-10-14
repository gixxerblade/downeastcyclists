import {Schema as S} from 'effect';

export const WaiverScope = S.Literal('membership', 'ride', 'event');
export type WaiverScope = S.Schema.Type<typeof WaiverScope>;

export const WaiverStatus = S.Literal('draft', 'published', 'retired');
export type WaiverStatus = S.Schema.Type<typeof WaiverStatus>;

export const WaiverSignerRole = S.Literal('adult', 'household');
export type WaiverSignerRole = S.Schema.Type<typeof WaiverSignerRole>;

const requiredText = (label: string, maximum = 255) =>
  S.Trim.pipe(
    S.minLength(1, {message: () => `${label} is required`}),
    S.maxLength(maximum, {message: () => `${label} is too long`}),
  );

export class WaiverFamilyMember extends S.Class<WaiverFamilyMember>('WaiverFamilyMember')({
  name: requiredText('Family member name'),
  birthDate: requiredText('Birth date', 10),
}) {}

export class WaiverSignatureInput extends S.Class<WaiverSignatureInput>('WaiverSignatureInput')({
  signerRole: WaiverSignerRole,
  signerName: requiredText('Signer name'),
  signerBirthDate: requiredText('Your birth date', 10),
  familyMembers: S.Array(WaiverFamilyMember).pipe(S.maxItems(49)),
  previousSignatureId: S.optional(S.UUID),
  phone: requiredText('Phone', 50),
  addressStreet: requiredText('Street address'),
  addressCity: requiredText('City', 100),
  addressState: requiredText('State', 50),
  addressZip: requiredText('ZIP code', 20),
  signatureText: requiredText('Electronic signature'),
  consent: S.Literal(true),
}) {}

export class WaiverTemplateInput extends S.Class<WaiverTemplateInput>('WaiverTemplateInput')({
  title: requiredText('Title'),
  description: S.optional(S.String),
  scope: WaiverScope,
  content: requiredText('Waiver terms', 50_000),
  acknowledgment: requiredText('Acknowledgment', 2_000),
  isRequired: S.Boolean,
  effectiveFrom: S.optional(S.String),
  expiresAt: S.optional(S.String),
}) {}

export class WaiverTemplateUpdate extends S.Class<WaiverTemplateUpdate>('WaiverTemplateUpdate')({
  action: S.Literal('publish', 'retire'),
}) {}

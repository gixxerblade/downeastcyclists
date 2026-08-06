import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';

import {z} from 'zod';

import {
  TRAIL_MAINTENANCE_PHOTO_LIMIT,
  TRAIL_MAINTENANCE_PHOTO_MAX_BYTES,
  TRAIL_MAINTENANCE_UPLOAD_TTL_SECONDS,
  trailMaintenancePhotoContentTypes,
} from './constants';

const TOKEN_VERSION = 1;
const PUBLIC_ID_PATTERN = /^[A-F0-9]{12}$/;
const STAGING_KEY_PATTERN = /^trail-maintenance-staging\/[A-F0-9]{12}\/[1-3]-[a-f0-9-]{36}$/;

export const trailPhotoUploadDescriptorSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().refine((value) => trailMaintenancePhotoContentTypes.includes(value), {
    message: 'Photos must be JPEG, PNG, or WebP images',
  }),
  byteSize: z.number().int().positive().max(TRAIL_MAINTENANCE_PHOTO_MAX_BYTES, {
    message: 'Photos must be no larger than 10 MB',
  }),
});

export const trailPhotoUploadRequestSchema = z.object({
  turnstileToken: z.string().trim().max(2048).optional(),
  files: z.array(trailPhotoUploadDescriptorSchema).max(TRAIL_MAINTENANCE_PHOTO_LIMIT, {
    message: `Upload up to ${TRAIL_MAINTENANCE_PHOTO_LIMIT} photos`,
  }),
});

const stagedTrailPhotoSchema = trailPhotoUploadDescriptorSchema.extend({
  objectKey: z.string().regex(STAGING_KEY_PATTERN),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .max(TRAIL_MAINTENANCE_PHOTO_LIMIT - 1),
});

const trailPhotoUploadSessionPayloadSchema = z
  .object({
    v: z.literal(TOKEN_VERSION),
    publicId: z.string().regex(PUBLIC_ID_PATTERN),
    iat: z.number().int(),
    exp: z.number().int(),
    files: z.array(stagedTrailPhotoSchema).max(TRAIL_MAINTENANCE_PHOTO_LIMIT),
  })
  .superRefine((payload, context) => {
    for (const [index, file] of payload.files.entries()) {
      if (
        file.sortOrder !== index ||
        !file.objectKey.startsWith(`trail-maintenance-staging/${payload.publicId}/${index + 1}-`)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['files', index],
          message: 'Invalid staged photo mapping',
        });
      }
    }
  });

export type TrailPhotoUploadDescriptor = z.infer<typeof trailPhotoUploadDescriptorSchema>;
export type StagedTrailPhoto = z.infer<typeof stagedTrailPhotoSchema>;
export type TrailPhotoUploadSessionPayload = z.infer<typeof trailPhotoUploadSessionPayloadSchema>;

export type TrailPhotoUploadSessionVerification =
  | {readonly ok: true; readonly payload: TrailPhotoUploadSessionPayload}
  | {readonly ok: false};

function getUploadSigningSecret(): string {
  const secret = process.env.TRAIL_MAINTENANCE_UPLOAD_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('TRAIL_MAINTENANCE_UPLOAD_SECRET must be at least 32 characters');
  }
  return secret;
}

function signatureFor(encodedPayload: string): Buffer {
  return createHmac('sha256', getUploadSigningSecret()).update(encodedPayload).digest();
}

function makePublicId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

export function createTrailPhotoUploadSession(
  files: readonly TrailPhotoUploadDescriptor[],
  now: Date = new Date(),
): {readonly token: string; readonly payload: TrailPhotoUploadSessionPayload} {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const publicId = makePublicId();
  const payload = trailPhotoUploadSessionPayloadSchema.parse({
    v: TOKEN_VERSION,
    publicId,
    iat: issuedAt,
    exp: issuedAt + TRAIL_MAINTENANCE_UPLOAD_TTL_SECONDS,
    files: files.map((file, index) => ({
      ...file,
      objectKey: `trail-maintenance-staging/${publicId}/${index + 1}-${randomUUID()}`,
      sortOrder: index,
    })),
  });
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signatureFor(encodedPayload).toString('base64url');

  return {token: `${encodedPayload}.${signature}`, payload};
}

export function verifyTrailPhotoUploadSession(
  token: string,
  now: Date = new Date(),
): TrailPhotoUploadSessionVerification {
  const [encodedPayload, encodedSignature, extraSegment] = token.split('.');
  if (!encodedPayload || !encodedSignature || extraSegment !== undefined) {
    return {ok: false};
  }

  let suppliedSignature: Buffer;
  let decodedPayload: unknown;
  try {
    suppliedSignature = Buffer.from(encodedSignature, 'base64url');
    decodedPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return {ok: false};
  }

  const expectedSignature = signatureFor(encodedPayload);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return {ok: false};
  }

  const decoded = trailPhotoUploadSessionPayloadSchema.safeParse(decodedPayload);
  if (!decoded.success) {
    return {ok: false};
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (decoded.data.exp <= nowSeconds || decoded.data.iat > nowSeconds + 60) {
    return {ok: false};
  }

  return {ok: true, payload: decoded.data};
}

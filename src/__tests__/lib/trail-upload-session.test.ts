import {describe, expect, it} from 'vitest';

import {
  createTrailPhotoUploadSession,
  trailPhotoUploadRequestSchema,
  verifyTrailPhotoUploadSession,
} from '@/src/lib/trail-maintenance/upload-session';

const NOW = new Date('2026-08-06T19:00:00.000Z');
const PHOTO = {
  originalFilename: 'trail obstruction.jpg',
  contentType: 'image/jpeg',
  byteSize: 4_000_000,
};

describe('trail photo upload sessions', () => {
  it('creates a signed session with private, ordered staging keys', () => {
    process.env.TRAIL_MAINTENANCE_UPLOAD_SECRET =
      'test-upload-secret-that-is-at-least-32-characters';

    const session = createTrailPhotoUploadSession([PHOTO, {...PHOTO, byteSize: 2_000_000}], NOW);
    const verification = verifyTrailPhotoUploadSession(session.token, NOW);

    expect(verification.ok).toBe(true);
    if (!verification.ok) return;
    expect(verification.payload.files).toHaveLength(2);
    expect(verification.payload.files[0]?.sortOrder).toBe(0);
    expect(verification.payload.files[0]?.objectKey).toMatch(
      new RegExp(`^trail-maintenance-staging/${verification.payload.publicId}/1-`),
    );
    expect(verification.payload.exp - verification.payload.iat).toBe(15 * 60);
  });

  it('rejects tampered and expired sessions', () => {
    process.env.TRAIL_MAINTENANCE_UPLOAD_SECRET =
      'test-upload-secret-that-is-at-least-32-characters';

    const session = createTrailPhotoUploadSession([PHOTO], NOW);
    const tampered = `${session.token.slice(0, -1)}x`;

    expect(verifyTrailPhotoUploadSession(tampered, NOW)).toEqual({ok: false});
    expect(
      verifyTrailPhotoUploadSession(session.token, new Date(NOW.getTime() + 15 * 60_000)),
    ).toEqual({ok: false});
  });

  it('enforces the upload count, content type, and per-photo size before signing', () => {
    expect(
      trailPhotoUploadRequestSchema.safeParse({
        files: [PHOTO, PHOTO, PHOTO],
      }).success,
    ).toBe(true);
    expect(
      trailPhotoUploadRequestSchema.safeParse({
        files: [PHOTO, PHOTO, PHOTO, PHOTO],
      }).success,
    ).toBe(false);
    expect(
      trailPhotoUploadRequestSchema.safeParse({
        files: [{...PHOTO, contentType: 'image/svg+xml'}],
      }).success,
    ).toBe(false);
    expect(
      trailPhotoUploadRequestSchema.safeParse({
        files: [{...PHOTO, byteSize: 11_176_013}],
      }).success,
    ).toBe(true);
    expect(
      trailPhotoUploadRequestSchema.safeParse({
        files: [{...PHOTO, byteSize: 20 * 1024 * 1024 + 1}],
      }).success,
    ).toBe(false);
  });
});

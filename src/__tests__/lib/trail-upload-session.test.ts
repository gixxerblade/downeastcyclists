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
    // Distinct canonical base64url endings always change the decoded signature bytes.
    const tampered = `${session.token.slice(0, -1)}${session.token.endsWith('A') ? 'Q' : 'A'}`;

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

describe('queued upload authorization renewal', () => {
  it('renews expired uploads with the same identity and staging keys, without extending the seven-day limit', async () => {
    const {renewTrailPhotoUploadSession} =
      await import('@/src/lib/trail-maintenance/upload-session');
    process.env.TRAIL_MAINTENANCE_UPLOAD_SECRET =
      'test-upload-secret-that-is-at-least-32-characters';
    const original = createTrailPhotoUploadSession([PHOTO], NOW);
    const later = new Date(NOW.getTime() + 24 * 60 * 60_000);
    const renewed = renewTrailPhotoUploadSession(original.token, later);
    expect(renewed?.payload.publicId).toBe(original.payload.publicId);
    expect(renewed?.payload.files).toEqual(original.payload.files);
    expect(renewed?.payload.iat).toBe(original.payload.iat);
    expect(renewed && verifyTrailPhotoUploadSession(renewed.token, later).ok).toBe(true);
    expect(
      renewTrailPhotoUploadSession(
        renewed?.token || '',
        new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
      ),
    ).toBeNull();
    expect(renewTrailPhotoUploadSession(`${original.token}tampered`, later)).toBeNull();
  });
});

it('accepts an old signed token only for receipt lookup, never for uploads or renewal', () => {
  process.env.TRAIL_MAINTENANCE_UPLOAD_SECRET = 'test-upload-secret-that-is-at-least-32-characters';
  const original = createTrailPhotoUploadSession([PHOTO], NOW);
  const monthLater = new Date(NOW.getTime() + 30 * 24 * 60 * 60_000);
  expect(verifyTrailPhotoUploadSession(original.token, monthLater, 'receipt').ok).toBe(true);
  expect(verifyTrailPhotoUploadSession(original.token, monthLater).ok).toBe(false);
  expect(verifyTrailPhotoUploadSession(original.token, monthLater, 'renewal').ok).toBe(false);
  expect(verifyTrailPhotoUploadSession(`${original.token}tampered`, monthLater, 'receipt').ok).toBe(
    false,
  );
});

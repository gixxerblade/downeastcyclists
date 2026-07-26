import {describe, expect, it} from 'vitest';

import {normalizeTrailPhoto, TrailPhotoValidationError} from '@/src/lib/trail-maintenance/r2';

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
);

describe('trail photo validation', () => {
  it('uses decoded content and emits a metadata-free WebP with a derived filename', async () => {
    const file = new File([ONE_PIXEL_PNG], '..\\..\\portrait.svg', {type: 'image/svg+xml'});

    const normalized = await normalizeTrailPhoto(file);

    expect(normalized.contentType).toBe('image/webp');
    expect(normalized.extension).toBe('webp');
    expect(normalized.originalFilename).toBe('portrait.webp');
    expect(Buffer.from(normalized.body).subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(Buffer.from(normalized.body).subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  it('rejects active content disguised with an image MIME type and filename', async () => {
    const disguisedSvg = new File(
      [new TextEncoder().encode('<svg onload="alert(1)"></svg>')],
      'photo.jpg',
      {type: 'image/jpeg'},
    );

    await expect(normalizeTrailPhoto(disguisedSvg)).rejects.toBeInstanceOf(
      TrailPhotoValidationError,
    );
  });
});

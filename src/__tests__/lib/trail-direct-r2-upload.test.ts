import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  createTrailPhotoUploadTargets,
  storeTrailMaintenancePhotosFromUploads,
  TrailPhotoValidationError,
} from '@/src/lib/trail-maintenance/r2';
import {createTrailPhotoUploadSession} from '@/src/lib/trail-maintenance/upload-session';

const NOW = new Date('2026-08-06T19:00:00.000Z');
const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
);

function pngBody(): ArrayBuffer {
  const copy = new Uint8Array(ONE_PIXEL_PNG.byteLength);
  copy.set(ONE_PIXEL_PNG);
  return copy.buffer;
}

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = 'test-account';
  process.env.R2_ACCESS_KEY_ID = 'test-access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.R2_BUCKET_NAME = 'test-bucket';
  process.env.TRAIL_MAINTENANCE_UPLOAD_SECRET = 'test-upload-secret-that-is-at-least-32-characters';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('direct R2 trail photo uploads', () => {
  it('creates content-type-bound PUT URLs with a 15-minute expiry', async () => {
    const session = createTrailPhotoUploadSession(
      [
        {
          originalFilename: 'trail.png',
          contentType: 'image/png',
          byteSize: ONE_PIXEL_PNG.byteLength,
        },
      ],
      NOW,
    );

    const [target] = await createTrailPhotoUploadTargets({files: session.payload.files, now: NOW});

    expect(target).toBeDefined();
    if (!target) return;
    const url = new URL(target.uploadUrl);
    expect(url.hostname).toBe('test-account.r2.cloudflarestorage.com');
    expect(url.pathname).toContain('/test-bucket/trail-maintenance-staging/');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('revalidates, normalizes, stores, and removes a staged upload', async () => {
    const session = createTrailPhotoUploadSession(
      [
        {
          originalFilename: 'trail.png',
          contentType: 'image/png',
          byteSize: ONE_PIXEL_PNG.byteLength,
        },
      ],
      NOW,
    );
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        methods.push(method);
        if (method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Length': String(ONE_PIXEL_PNG.byteLength),
              'Content-Type': 'image/png',
            },
          });
        }
        if (method === 'GET') {
          return new Response(pngBody(), {
            status: 200,
            headers: {'Content-Length': String(ONE_PIXEL_PNG.byteLength)},
          });
        }
        return new Response(null, {status: method === 'DELETE' ? 204 : 200});
      }),
    );

    const stored = await storeTrailMaintenancePhotosFromUploads({
      publicId: session.payload.publicId,
      files: session.payload.files,
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      contentType: 'image/webp',
      originalFilename: 'trail.webp',
      sortOrder: 0,
    });
    expect(stored[0]?.objectKey).toBe(`trail-maintenance/${session.payload.publicId}/1.webp`);
    expect(methods).toEqual(['HEAD', 'GET', 'PUT', 'DELETE']);
  });

  it('rejects an object whose stored size differs and still removes staging', async () => {
    const session = createTrailPhotoUploadSession(
      [
        {
          originalFilename: 'trail.png',
          contentType: 'image/png',
          byteSize: ONE_PIXEL_PNG.byteLength,
        },
      ],
      NOW,
    );
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        methods.push(method);
        if (method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Length': String(ONE_PIXEL_PNG.byteLength + 1),
              'Content-Type': 'image/png',
            },
          });
        }
        return new Response(null, {status: 204});
      }),
    );

    await expect(
      storeTrailMaintenancePhotosFromUploads({
        publicId: session.payload.publicId,
        files: session.payload.files,
      }),
    ).rejects.toBeInstanceOf(TrailPhotoValidationError);
    expect(methods).toEqual(['HEAD', 'DELETE']);
  });
});

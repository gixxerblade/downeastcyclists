import {createHash, createHmac} from 'node:crypto';
import {basename} from 'node:path';

import {AwsClient} from 'aws4fetch';
import sharp from 'sharp';

import {TRAIL_MAINTENANCE_PHOTO_MAX_BYTES, TRAIL_MAINTENANCE_UPLOAD_TTL_SECONDS} from './constants';
import type {StagedTrailPhoto} from './upload-session';

export interface StoredTrailPhoto {
  readonly bucketName: string;
  readonly objectKey: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly sortOrder: number;
}

export interface TrailPhotoUploadTarget {
  readonly uploadUrl: string;
  readonly contentType: string;
  readonly sortOrder: number;
}

interface R2Config {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucketName: string;
}

const R2_REGION = 'auto';
const R2_SERVICE = 's3';
const ALLOWED_SOURCE_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_INPUT_PIXELS = 40_000_000;

export class TrailPhotoValidationError extends Error {
  readonly name = 'TrailPhotoValidationError';
}

export interface NormalizedTrailPhoto {
  readonly body: Uint8Array;
  readonly contentType: 'image/webp';
  readonly extension: 'webp';
  readonly originalFilename: string;
  readonly byteSize: number;
}

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}

function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function copyToArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function formatAmzDate(date: Date): {readonly dateStamp: string; readonly amzDate: string} {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    dateStamp: iso.slice(0, 8),
    amzDate: iso,
  };
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalUri(bucketName: string, objectKey: string): string {
  return `/${encodePathSegment(bucketName)}/${objectKey
    .split('/')
    .map(encodePathSegment)
    .join('/')}`;
}

function signingKey(secretAccessKey: string, dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, R2_REGION);
  const serviceKey = hmac(regionKey, R2_SERVICE);
  return hmac(serviceKey, 'aws4_request');
}

function signature({
  secretAccessKey,
  dateStamp,
  amzDate,
  canonicalRequest,
}: {
  readonly secretAccessKey: string;
  readonly dateStamp: string;
  readonly amzDate: string;
  readonly canonicalRequest: string;
}): string {
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hash(canonicalRequest)].join(
    '\n',
  );

  return createHmac('sha256', signingKey(secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest('hex');
}

function r2Endpoint(config: R2Config, objectKey: string): URL {
  return new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com${canonicalUri(
      config.bucketName,
      objectKey,
    )}`,
  );
}

async function presignedObjectUrl({
  config,
  method,
  objectKey,
  expiresSeconds,
  contentType,
  now = new Date(),
}: {
  readonly config: R2Config;
  readonly method: 'GET' | 'HEAD' | 'PUT' | 'DELETE';
  readonly objectKey: string;
  readonly expiresSeconds: number;
  readonly contentType?: string;
  readonly now?: Date;
}): Promise<string> {
  const url = r2Endpoint(config, objectKey);
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: R2_SERVICE,
    region: R2_REGION,
  });
  const signed = await client.sign(url, {
    method,
    headers: contentType ? {'Content-Type': contentType} : undefined,
    aws: {
      signQuery: true,
      allHeaders: contentType !== undefined,
      datetime: formatAmzDate(now).amzDate,
    },
  });
  return signed.url;
}

function putObjectHeaders({
  config,
  objectKey,
  contentType,
  payloadHash,
}: {
  readonly config: R2Config;
  readonly objectKey: string;
  readonly contentType: string;
  readonly payloadHash: string;
}): Headers {
  const {dateStamp, amzDate} = formatAmzDate(new Date());
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri(config.bucketName, objectKey),
    '',
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const authorization = `AWS4-HMAC-SHA256 ${[
    `Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature({
      secretAccessKey: config.secretAccessKey,
      dateStamp,
      amzDate,
      canonicalRequest,
    })}`,
  ].join(', ')}`;

  return new Headers({
    Authorization: authorization,
    'Content-Type': contentType,
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
  });
}

async function putObject({
  config,
  objectKey,
  body,
  contentType,
}: {
  readonly config: R2Config;
  readonly objectKey: string;
  readonly body: Uint8Array;
  readonly contentType: string;
}): Promise<void> {
  const payloadHash = hash(body);
  const response = await fetch(r2Endpoint(config, objectKey), {
    method: 'PUT',
    headers: putObjectHeaders({config, objectKey, contentType, payloadHash}),
    body: copyToArrayBuffer(body),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Cloudflare R2 upload failed with status ${response.status}${
        body ? `: ${body.slice(0, 500)}` : ''
      }`,
    );
  }
}

async function deleteObject(config: R2Config, objectKey: string): Promise<void> {
  const deleteUrl = await presignedObjectUrl({
    config,
    method: 'DELETE',
    objectKey,
    expiresSeconds: 60,
  });
  const response = await fetch(deleteUrl, {method: 'DELETE'});

  if (!response.ok && response.status !== 404) {
    throw new Error(`Cloudflare R2 delete failed with status ${response.status}`);
  }
}

async function cleanupObjects(config: R2Config, objectKeys: readonly string[]): Promise<void> {
  const results = await Promise.allSettled(
    objectKeys.map((objectKey) => deleteObject(config, objectKey)),
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[TrailMaintenance] Failed to clean up R2 object:', result.reason);
    }
  }
}

export async function normalizeTrailPhoto(file: File): Promise<NormalizedTrailPhoto> {
  if (file.size <= 0 || file.size > TRAIL_MAINTENANCE_PHOTO_MAX_BYTES) {
    throw new TrailPhotoValidationError('Photos must be no larger than 20 MB');
  }

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, {
    animated: false,
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  });

  let metadata: Awaited<ReturnType<typeof image.metadata>>;
  try {
    metadata = await image.metadata();
  } catch {
    throw new TrailPhotoValidationError('Photos must be valid JPEG, PNG, or WebP images');
  }

  if (
    !metadata.format ||
    !ALLOWED_SOURCE_FORMATS.has(metadata.format) ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new TrailPhotoValidationError('Photos must be valid JPEG, PNG, or WebP images');
  }

  let output: Buffer;
  try {
    output = await image.rotate().webp({quality: 85}).toBuffer();
  } catch {
    throw new TrailPhotoValidationError('Photos must be valid JPEG, PNG, or WebP images');
  }

  if (output.length > TRAIL_MAINTENANCE_PHOTO_MAX_BYTES) {
    throw new TrailPhotoValidationError('The processed photo is too large');
  }

  const filenameStem = basename(file.name.replaceAll('\\', '/')).replace(/\.[^.]*$/, '');
  const safeStem = filenameStem.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 250) || 'photo';

  return {
    body: Uint8Array.from(output),
    contentType: 'image/webp',
    extension: 'webp',
    originalFilename: `${safeStem}.webp`,
    byteSize: output.length,
  };
}

export async function createTrailPhotoUploadTargets({
  files,
  now = new Date(),
}: {
  readonly files: readonly StagedTrailPhoto[];
  readonly now?: Date;
}): Promise<TrailPhotoUploadTarget[]> {
  if (files.length === 0) return [];

  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  return Promise.all(
    files.map(async (file) => ({
      uploadUrl: await presignedObjectUrl({
        config,
        method: 'PUT',
        objectKey: file.objectKey,
        expiresSeconds: TRAIL_MAINTENANCE_UPLOAD_TTL_SECONDS,
        contentType: file.contentType,
        now,
      }),
      contentType: file.contentType,
      sortOrder: file.sortOrder,
    })),
  );
}

async function loadStagedPhoto({
  config,
  file,
}: {
  readonly config: R2Config;
  readonly file: StagedTrailPhoto;
}): Promise<File> {
  const headUrl = await presignedObjectUrl({
    config,
    method: 'HEAD',
    objectKey: file.objectKey,
    expiresSeconds: 60,
  });
  const headResponse = await fetch(headUrl, {method: 'HEAD'});
  if (headResponse.status === 404) {
    throw new TrailPhotoValidationError('A photo upload is missing or expired');
  }
  if (!headResponse.ok) {
    throw new Error(`Cloudflare R2 metadata request failed with status ${headResponse.status}`);
  }

  const storedByteSize = Number(headResponse.headers.get('content-length'));
  const storedContentType = headResponse.headers.get('content-type')?.split(';')[0]?.trim();
  if (
    !Number.isSafeInteger(storedByteSize) ||
    storedByteSize <= 0 ||
    storedByteSize > TRAIL_MAINTENANCE_PHOTO_MAX_BYTES ||
    storedByteSize !== file.byteSize
  ) {
    throw new TrailPhotoValidationError('A photo upload has an invalid size');
  }
  if (storedContentType !== file.contentType) {
    throw new TrailPhotoValidationError('A photo upload has an invalid content type');
  }

  const getUrl = await presignedObjectUrl({
    config,
    method: 'GET',
    objectKey: file.objectKey,
    expiresSeconds: 60,
  });
  const getResponse = await fetch(getUrl);
  if (!getResponse.ok) {
    throw new Error(`Cloudflare R2 download failed with status ${getResponse.status}`);
  }

  const downloadedByteSize = Number(getResponse.headers.get('content-length'));
  if (
    !Number.isSafeInteger(downloadedByteSize) ||
    downloadedByteSize !== storedByteSize ||
    downloadedByteSize > TRAIL_MAINTENANCE_PHOTO_MAX_BYTES
  ) {
    throw new TrailPhotoValidationError('A photo upload changed before it was processed');
  }

  const body = await getResponse.arrayBuffer();
  if (body.byteLength !== storedByteSize) {
    throw new TrailPhotoValidationError('A photo upload is incomplete');
  }

  return new File([body], file.originalFilename, {type: file.contentType});
}

export async function storeTrailMaintenancePhotosFromUploads({
  publicId,
  files,
}: {
  readonly publicId: string;
  readonly files: readonly StagedTrailPhoto[];
}): Promise<StoredTrailPhoto[]> {
  if (files.length === 0) return [];

  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const writtenObjectKeys: string[] = [];
  try {
    const normalizedPhotos: Array<{
      readonly normalized: NormalizedTrailPhoto;
      readonly sortOrder: number;
    }> = [];
    for (const file of files) {
      const stagedFile = await loadStagedPhoto({config, file});
      normalizedPhotos.push({
        normalized: await normalizeTrailPhoto(stagedFile),
        sortOrder: file.sortOrder,
      });
    }

    const storedPhotos: StoredTrailPhoto[] = [];
    try {
      for (const {normalized, sortOrder} of normalizedPhotos) {
        const objectKey = `trail-maintenance/${publicId}/${sortOrder + 1}.${normalized.extension}`;
        await putObject({
          config,
          objectKey,
          body: normalized.body,
          contentType: normalized.contentType,
        });
        writtenObjectKeys.push(objectKey);
        storedPhotos.push({
          bucketName: config.bucketName,
          objectKey,
          originalFilename: normalized.originalFilename,
          contentType: normalized.contentType,
          byteSize: normalized.byteSize,
          sortOrder,
        });
      }
      return storedPhotos;
    } catch (error) {
      await cleanupObjects(config, writtenObjectKeys);
      throw error;
    }
  } finally {
    await cleanupObjects(
      config,
      files.map((file) => file.objectKey),
    );
  }
}

export async function getTrailPhotoSignedUrl({
  bucketName,
  objectKey,
}: {
  readonly bucketName: string;
  readonly objectKey: string;
}): Promise<string | null> {
  const config = getR2Config();
  if (!config || bucketName !== config.bucketName) return null;
  return await presignedObjectUrl({
    config,
    method: 'GET',
    objectKey,
    expiresSeconds: 15 * 60,
  });
}

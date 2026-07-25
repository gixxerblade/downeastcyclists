import {createHash, createHmac} from 'crypto';

import {TRAIL_MAINTENANCE_PHOTO_MAX_BYTES, TRAIL_MAINTENANCE_PHOTO_LIMIT} from './constants';

export interface StoredTrailPhoto {
  readonly bucketName: string;
  readonly objectKey: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
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

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
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

function canonicalQuery(params: ReadonlyMap<string, string>): string {
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodePathSegment(key)}=${encodePathSegment(value)}`)
    .join('&');
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
  readonly body: ArrayBuffer;
  readonly contentType: string;
}): Promise<void> {
  const payloadHash = hash(Buffer.from(body));
  const response = await fetch(r2Endpoint(config, objectKey), {
    method: 'PUT',
    headers: putObjectHeaders({config, objectKey, contentType, payloadHash}),
    body,
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

export function isAllowedTrailPhoto(file: File): boolean {
  return (
    file.type.startsWith('image/') &&
    file.size > 0 &&
    file.size <= TRAIL_MAINTENANCE_PHOTO_MAX_BYTES
  );
}

export async function storeTrailMaintenancePhotos({
  publicId,
  files,
}: {
  readonly publicId: string;
  readonly files: readonly File[];
}): Promise<StoredTrailPhoto[]> {
  if (files.length === 0) return [];

  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  if (files.length > TRAIL_MAINTENANCE_PHOTO_LIMIT) {
    throw new Error(`Upload up to ${TRAIL_MAINTENANCE_PHOTO_LIMIT} photos`);
  }

  const uploads: StoredTrailPhoto[] = [];
  for (const [index, file] of files.entries()) {
    if (!isAllowedTrailPhoto(file)) {
      throw new Error('Photos must be image files no larger than 10 MB');
    }

    const extension =
      file.name
        .split('.')
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'jpg';
    const objectKey = `trail-maintenance/${publicId}/${index + 1}.${extension}`;
    const body = await file.arrayBuffer();

    await putObject({
      config,
      objectKey,
      body,
      contentType: file.type,
    });

    uploads.push({
      bucketName: config.bucketName,
      objectKey,
      originalFilename: file.name,
      contentType: file.type,
      byteSize: file.size,
      sortOrder: index,
    });
  }

  return uploads;
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

  const {dateStamp, amzDate} = formatAmzDate(new Date());
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const params = new Map([
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${config.accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(15 * 60)],
    ['X-Amz-SignedHeaders', 'host'],
  ]);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalRequest = [
    'GET',
    canonicalUri(config.bucketName, objectKey),
    canonicalQuery(params),
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  params.set(
    'X-Amz-Signature',
    signature({
      secretAccessKey: config.secretAccessKey,
      dateStamp,
      amzDate,
      canonicalRequest,
    }),
  );

  const url = r2Endpoint(config, objectKey);
  url.search = canonicalQuery(params);
  return url.toString();
}

import {createHmac, timingSafeEqual} from 'node:crypto';

import {Either, Schema as S} from 'effect';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_DAYS = 120;
const SECONDS_PER_DAY = 24 * 60 * 60;

const RenewalTokenPayload = S.Struct({
  v: S.Literal(TOKEN_VERSION),
  sub: S.String.pipe(S.minLength(1), S.maxLength(128)),
  iat: S.Number,
  exp: S.Number,
});

export type RenewalTokenPayload = S.Schema.Type<typeof RenewalTokenPayload>;

export type RenewalTokenVerification =
  | {readonly ok: true; readonly payload: RenewalTokenPayload}
  | {readonly ok: false};

function getRenewalLinkSecret(): string {
  const secret = process.env.RENEWAL_LINK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RENEWAL_LINK_SECRET must be at least 32 characters');
  }
  return secret;
}

function signatureFor(encodedPayload: string): Buffer {
  return createHmac('sha256', getRenewalLinkSecret()).update(encodedPayload).digest();
}

function getTtlSeconds(): number {
  const configuredDays = Number(process.env.RENEWAL_LINK_TTL_DAYS);
  const days =
    Number.isFinite(configuredDays) && configuredDays >= 1 && configuredDays <= 365
      ? configuredDays
      : DEFAULT_TTL_DAYS;
  return Math.floor(days * SECONDS_PER_DAY);
}

export function createRenewalToken(userId: string, now: Date = new Date()): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: RenewalTokenPayload = {
    v: TOKEN_VERSION,
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + getTtlSeconds(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signatureFor(encodedPayload).toString('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyRenewalToken(
  token: string,
  now: Date = new Date(),
): RenewalTokenVerification {
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

  const decoded = S.decodeUnknownEither(RenewalTokenPayload)(decodedPayload);
  if (Either.isLeft(decoded)) {
    return {ok: false};
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (decoded.right.exp <= nowSeconds || decoded.right.iat > nowSeconds + 60) {
    return {ok: false};
  }

  return {ok: true, payload: decoded.right};
}

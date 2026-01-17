import crypto from 'crypto';

import {Context, Effect, Layer} from 'effect';
import QRCode from 'qrcode';

import {QRError} from './errors';
import type {QRPayload} from './schemas';

// Service interface
export interface QRService {
  readonly generateQRData: (payload: {
    membershipNumber: string;
    userId: string;
    validUntil: Date;
  }) => Effect.Effect<string, QRError>;

  readonly generateQRImage: (
    data: string,
    options?: {width?: number; margin?: number},
  ) => Effect.Effect<string, QRError>; // Returns data URL

  readonly verifyQRData: (data: string) => Effect.Effect<QRPayload & {verified: boolean}, QRError>;
}

// Service tag
export const QRService = Context.GenericTag<QRService>('QRService');

// Secret for signing (should be in env)
const getSigningSecret = () => process.env.QR_SIGNING_SECRET || 'dec-membership-secret-2025';

// Implementation
const make = Effect.sync(() => {
  const secret = getSigningSecret();

  return QRService.of({
    // Generate compact QR payload with signature
    generateQRData: ({membershipNumber, userId, validUntil}) =>
      Effect.try({
        try: () => {
          // Create compact date (YYYYMMDD)
          const compactDate = validUntil.toISOString().slice(0, 10).replace(/-/g, '');

          // Create signature
          const dataToSign = `${membershipNumber}:${userId.slice(0, 8)}:${compactDate}`;
          const signature = crypto
            .createHmac('sha256', secret)
            .update(dataToSign)
            .digest('hex')
            .slice(0, 8); // Truncate for compact QR

          const payload: QRPayload = {
            mn: membershipNumber,
            u: userId.slice(0, 8),
            v: compactDate,
            s: signature,
          };

          return JSON.stringify(payload);
        },
        catch: (error) =>
          new QRError({
            code: 'QR_DATA_GENERATION_FAILED',
            message: 'Failed to generate QR data',
            cause: error,
          }),
      }),

    // Generate QR code image as data URL
    generateQRImage: (data, options = {}) =>
      Effect.tryPromise({
        try: () =>
          QRCode.toDataURL(data, {
            width: options.width || 200,
            margin: options.margin || 2,
            errorCorrectionLevel: 'M',
          }),
        catch: (error) =>
          new QRError({
            code: 'QR_IMAGE_GENERATION_FAILED',
            message: 'Failed to generate QR code image',
            cause: error,
          }),
      }),

    // Verify QR data and signature
    verifyQRData: (data) =>
      Effect.try({
        try: () => {
          const payload = JSON.parse(data) as QRPayload;

          // Recreate signature to verify
          const dataToSign = `${payload.mn}:${payload.u}:${payload.v}`;
          const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(dataToSign)
            .digest('hex')
            .slice(0, 8);

          return {
            ...payload,
            verified: payload.s === expectedSignature,
          };
        },
        catch: (error) =>
          new QRError({
            code: 'QR_VERIFICATION_FAILED',
            message: 'Failed to verify QR data',
            cause: error,
          }),
      }),
  });
});

// Live layer
export const QRServiceLive = Layer.effect(QRService, make);

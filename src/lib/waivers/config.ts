import {Data, Effect} from 'effect';

export class WaiverConfigurationError extends Data.TaggedError('WaiverConfigurationError')<{
  readonly message: string;
}> {}

// This protects stored IP evidence; it is not a document-signing certificate.
export const waiverSignatureSecret = Effect.fn('Waivers.signatureSecret')(function* () {
  const secret = process.env.WAIVER_SIGNATURE_SECRET?.trim();
  if (!secret || secret.length < 32 || secret.startsWith('replace-with-')) {
    return yield* new WaiverConfigurationError({
      message:
        'Waiver signing is unavailable: configure WAIVER_SIGNATURE_SECRET with an independent random secret of at least 32 characters.',
    });
  }
  return secret;
});

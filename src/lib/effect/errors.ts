import {Data} from 'effect';

// Tagged errors for granular handling with Effect.catchTag
export class StripeError extends Data.TaggedError('StripeError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FirestoreError extends Data.TaggedError('FirestoreError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly resource: string;
  readonly id: string;
}> {}

export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  readonly message: string;
}> {}

export class AuthError extends Data.TaggedError('AuthError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SessionError extends Data.TaggedError('SessionError')<{
  readonly code: string;
  readonly message: string;
}> {}

export class DuplicateWebhookError extends Data.TaggedError('DuplicateWebhookError')<{
  readonly eventId: string;
  readonly processedAt: Date;
}> {}

export class WebhookProcessingError extends Data.TaggedError('WebhookProcessingError')<{
  readonly eventId: string;
  readonly eventType: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class IncompletePaymentError extends Data.TaggedError('IncompletePaymentError')<{
  readonly subscriptionId: string;
  readonly status: string;
  readonly message: string;
}> {}

export class CardError extends Data.TaggedError('CardError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class QRError extends Data.TaggedError('QRError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AdminError extends Data.TaggedError('AdminError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ExportError extends Data.TaggedError('ExportError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class MemberNotFoundError extends Data.TaggedError('MemberNotFoundError')<{
  readonly userId: string;
  readonly message: string;
}> {}

export class EmailConflictError extends Data.TaggedError('EmailConflictError')<{
  readonly email: string;
  readonly message: string;
}> {}

export class StripeSubscriptionActiveError extends Data.TaggedError(
  'StripeSubscriptionActiveError',
)<{
  readonly subscriptionId: string;
  readonly message: string;
}> {}

export class ImportError extends Data.TaggedError('ImportError')<{
  readonly code: string;
  readonly message: string;
  readonly row?: number;
  readonly cause?: unknown;
}> {}

// Union type for all errors
export type AppError =
  | StripeError
  | FirestoreError
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | AuthError
  | SessionError
  | DuplicateWebhookError
  | WebhookProcessingError
  | IncompletePaymentError
  | CardError
  | QRError
  | AdminError
  | ExportError
  | MemberNotFoundError
  | EmailConflictError
  | StripeSubscriptionActiveError
  | ImportError;

import { Data } from "effect";

// Tagged errors for granular handling with Effect.catchTag
export class StripeError extends Data.TaggedError("StripeError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FirestoreError extends Data.TaggedError("FirestoreError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

// Union type for all errors
export type AppError =
  | StripeError
  | FirestoreError
  | ValidationError
  | NotFoundError
  | UnauthorizedError;

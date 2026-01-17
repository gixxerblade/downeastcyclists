import {Firestore, FieldValue, Timestamp} from '@google-cloud/firestore';
import {Context, Effect, Layer} from 'effect';

import {FirestoreError, DuplicateWebhookError} from './errors';
import type {WebhookEventDocument} from './schemas';

export const WEBHOOK_EVENTS_COLLECTION = 'webhookEvents';

// Service interface
export interface WebhookIdempotencyService {
  /**
   * Check if event was already processed
   */
  readonly checkEvent: (
    eventId: string,
  ) => Effect.Effect<WebhookEventDocument | null, FirestoreError>;

  /**
   * Mark event as processing (claim it)
   * Fails if event was already claimed by another process
   */
  readonly claimEvent: (
    eventId: string,
    eventType: string,
  ) => Effect.Effect<void, FirestoreError | DuplicateWebhookError>;

  /**
   * Mark event as completed
   */
  readonly completeEvent: (eventId: string) => Effect.Effect<void, FirestoreError>;

  /**
   * Mark event as failed with error message
   */
  readonly failEvent: (
    eventId: string,
    errorMessage: string,
  ) => Effect.Effect<void, FirestoreError>;

  /**
   * Clean up old webhook events (retention: 30 days)
   */
  readonly cleanupOldEvents: (olderThanDays: number) => Effect.Effect<number, FirestoreError>;
}

// Service tag
export const WebhookIdempotencyService = Context.GenericTag<WebhookIdempotencyService>(
  'WebhookIdempotencyService',
);

// Implementation
const make = Effect.sync(() => {
  const db = new Firestore({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
    },
  });

  return WebhookIdempotencyService.of({
    checkEvent: (eventId) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).get();
          if (!doc.exists) return null;
          return {id: doc.id, ...doc.data()} as WebhookEventDocument;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'CHECK_WEBHOOK_EVENT_FAILED',
            message: `Failed to check webhook event ${eventId}`,
            cause: error,
          }),
      }),

    claimEvent: (eventId, eventType) =>
      Effect.tryPromise({
        try: async () => {
          const docRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);

          // Use transaction to ensure atomic claim
          await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);

            if (doc.exists) {
              const data = doc.data() as WebhookEventDocument;

              // Already completed? Reject as duplicate
              if (data.status === 'completed') {
                throw {isDuplicate: true, processedAt: data.processedAt};
              }

              // Failed previously? Allow retry
              if (data.status === 'failed') {
                transaction.update(docRef, {
                  status: 'processing',
                  retryCount: FieldValue.increment(1),
                  updatedAt: FieldValue.serverTimestamp(),
                });
                return;
              }

              // Still processing? Check if stale (>5 min)
              const processingTime = (data.processedAt as any)?.toDate?.() || new Date(0);
              const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

              if (processingTime > staleThreshold) {
                // Recent processing, reject as duplicate
                throw {isDuplicate: true, processedAt: data.processedAt};
              }

              // Stale lock, reclaim
              transaction.update(docRef, {
                status: 'processing',
                retryCount: FieldValue.increment(1),
                processedAt: FieldValue.serverTimestamp(),
              });
            } else {
              // New event, claim it
              transaction.set(docRef, {
                id: eventId,
                type: eventType,
                status: 'processing',
                processedAt: FieldValue.serverTimestamp(),
                retryCount: 0,
              });
            }
          });
        },
        catch: (error: any) => {
          if (error.isDuplicate) {
            return new DuplicateWebhookError({
              eventId,
              processedAt: error.processedAt?.toDate?.() || new Date(),
            });
          }
          return new FirestoreError({
            code: 'CLAIM_WEBHOOK_EVENT_FAILED',
            message: `Failed to claim webhook event ${eventId}`,
            cause: error,
          });
        },
      }),

    completeEvent: (eventId) =>
      Effect.tryPromise({
        try: () =>
          db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).update({
            status: 'completed',
            completedAt: FieldValue.serverTimestamp(),
          }),
        catch: (error) =>
          new FirestoreError({
            code: 'COMPLETE_WEBHOOK_EVENT_FAILED',
            message: `Failed to complete webhook event ${eventId}`,
            cause: error,
          }),
      }),

    failEvent: (eventId, errorMessage) =>
      Effect.tryPromise({
        try: () =>
          db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).update({
            status: 'failed',
            errorMessage,
            failedAt: FieldValue.serverTimestamp(),
          }),
        catch: (error) =>
          new FirestoreError({
            code: 'FAIL_WEBHOOK_EVENT_FAILED',
            message: `Failed to mark webhook event ${eventId} as failed`,
            cause: error,
          }),
      }),

    cleanupOldEvents: (olderThanDays) =>
      Effect.tryPromise({
        try: async () => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - olderThanDays);

          const snapshot = await db
            .collection(WEBHOOK_EVENTS_COLLECTION)
            .where('processedAt', '<', Timestamp.fromDate(cutoff))
            .limit(500)
            .get();

          if (snapshot.empty) return 0;

          const batch = db.batch();
          snapshot.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();

          return snapshot.size;
        },
        catch: (error) =>
          new FirestoreError({
            code: 'CLEANUP_WEBHOOK_EVENTS_FAILED',
            message: 'Failed to cleanup old webhook events',
            cause: error,
          }),
      }),
  });
});

export const WebhookIdempotencyServiceLive = Layer.effect(WebhookIdempotencyService, make);

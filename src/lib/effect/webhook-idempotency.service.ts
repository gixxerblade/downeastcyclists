import {eq, lt, sql} from 'drizzle-orm';
import {Context, Effect, Layer} from 'effect';

import {webhookEvents} from '@/src/db/schema/tables';

import {DatabaseError, DuplicateWebhookError} from './errors';
import type {WebhookEventDocument} from './schemas';

// Service interface
export interface WebhookIdempotencyService {
  /**
   * Check if event was already processed
   */
  readonly checkEvent: (
    eventId: string,
  ) => Effect.Effect<WebhookEventDocument | null, DatabaseError>;

  /**
   * Mark event as processing (claim it)
   * Fails if event was already claimed by another process
   */
  readonly claimEvent: (
    eventId: string,
    eventType: string,
  ) => Effect.Effect<void, DatabaseError | DuplicateWebhookError>;

  /**
   * Mark event as completed
   */
  readonly completeEvent: (eventId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Mark event as failed with error message
   */
  readonly failEvent: (eventId: string, errorMessage: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Clean up old webhook events (retention: 30 days)
   */
  readonly cleanupOldEvents: (olderThanDays: number) => Effect.Effect<number, DatabaseError>;
}

// Service tag
export const WebhookIdempotencyService = Context.GenericTag<WebhookIdempotencyService>(
  'WebhookIdempotencyService',
);

// Stale lock threshold: 5 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Maps a Postgres row to the WebhookEventDocument schema shape.
 */
function rowToEventDocument(row: typeof webhookEvents.$inferSelect): WebhookEventDocument {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    processedAt: row.processedAt,
    errorMessage: row.errorMessage ?? undefined,
    retryCount: row.retryCount,
  };
}

// Implementation — db client is loaded lazily to avoid triggering
// Neon connection at import time (breaks test suites that don't mock it)
const make = Effect.sync(() => {
  const {db} = require('@/src/db/client') as typeof import('@/src/db/client');

  return WebhookIdempotencyService.of({
    checkEvent: (eventId) =>
      Effect.tryPromise({
        try: async () => {
          const row = await db
            .select()
            .from(webhookEvents)
            .where(eq(webhookEvents.id, eventId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (!row) return null;
          return rowToEventDocument(row);
        },
        catch: (error) =>
          new DatabaseError({
            code: 'CHECK_WEBHOOK_EVENT_FAILED',
            message: `Failed to check webhook event ${eventId}`,
            cause: error,
          }),
      }),

    claimEvent: (eventId, eventType) =>
      Effect.tryPromise({
        try: async () => {
          // Check for existing event first
          const existing = await db
            .select()
            .from(webhookEvents)
            .where(eq(webhookEvents.id, eventId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (existing) {
            // Already completed — reject as duplicate
            if (existing.status === 'completed') {
              throw {isDuplicate: true, processedAt: existing.processedAt};
            }

            // Failed previously — allow retry by resetting to processing
            if (existing.status === 'failed') {
              await db
                .update(webhookEvents)
                .set({
                  status: 'processing',
                  retryCount: sql`${webhookEvents.retryCount} + 1`,
                  processedAt: new Date(),
                })
                .where(eq(webhookEvents.id, eventId));
              return;
            }

            // Still processing — check if stale (>5 min)
            const processingTime = existing.processedAt;
            const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

            if (processingTime > staleThreshold) {
              // Recent processing, reject as duplicate
              throw {isDuplicate: true, processedAt: existing.processedAt};
            }

            // Stale lock, reclaim
            await db
              .update(webhookEvents)
              .set({
                status: 'processing',
                retryCount: sql`${webhookEvents.retryCount} + 1`,
                processedAt: new Date(),
              })
              .where(eq(webhookEvents.id, eventId));
            return;
          }

          // New event — insert with ON CONFLICT DO NOTHING for atomicity
          const result = await db
            .insert(webhookEvents)
            .values({
              id: eventId,
              type: eventType,
              status: 'processing',
              retryCount: 0,
              processedAt: new Date(),
            })
            .onConflictDoNothing({target: webhookEvents.id})
            .returning();

          // If INSERT returned nothing, another process claimed it first
          if (result.length === 0) {
            throw {isDuplicate: true, processedAt: new Date()};
          }
        },
        catch: (error: unknown) => {
          const err = error as Record<string, unknown> | null;
          if (typeof err === 'object' && err !== null && err.isDuplicate === true) {
            return new DuplicateWebhookError({
              eventId,
              processedAt: err.processedAt instanceof Date ? err.processedAt : new Date(),
            });
          }
          return new DatabaseError({
            code: 'CLAIM_WEBHOOK_EVENT_FAILED',
            message: `Failed to claim webhook event ${eventId}`,
            cause: error,
          });
        },
      }),

    completeEvent: (eventId) =>
      Effect.tryPromise({
        try: () =>
          db
            .update(webhookEvents)
            .set({
              status: 'completed',
              completedAt: new Date(),
            })
            .where(eq(webhookEvents.id, eventId))
            .then(() => undefined),
        catch: (error) =>
          new DatabaseError({
            code: 'COMPLETE_WEBHOOK_EVENT_FAILED',
            message: `Failed to complete webhook event ${eventId}`,
            cause: error,
          }),
      }),

    failEvent: (eventId, errorMessage) =>
      Effect.tryPromise({
        try: () =>
          db
            .update(webhookEvents)
            .set({
              status: 'failed',
              errorMessage,
              failedAt: new Date(),
            })
            .where(eq(webhookEvents.id, eventId))
            .then(() => undefined),
        catch: (error) =>
          new DatabaseError({
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

          const deleted = await db
            .delete(webhookEvents)
            .where(lt(webhookEvents.processedAt, cutoff))
            .returning({id: webhookEvents.id});

          return deleted.length;
        },
        catch: (error) =>
          new DatabaseError({
            code: 'CLEANUP_WEBHOOK_EVENTS_FAILED',
            message: 'Failed to cleanup old webhook events',
            cause: error,
          }),
      }),
  });
});

export const WebhookIdempotencyServiceLive = Layer.effect(WebhookIdempotencyService, make);

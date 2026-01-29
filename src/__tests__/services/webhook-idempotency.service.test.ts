import {Effect, Exit} from 'effect';
import {describe, it, expect, vi} from 'vitest';

import {FirestoreError, DuplicateWebhookError} from '@/src/lib/effect/errors';
import {WebhookIdempotencyService} from '@/src/lib/effect/webhook-idempotency.service';

import {createTestWebhookService, TestWebhookLayer} from '../layers/test-layers';
import {createMockWebhookEvent} from '../mocks/firestore.mock';

describe('WebhookIdempotencyService', () => {
  describe('claimEvent', () => {
    it('should claim new event successfully', async () => {
      const mockService = createTestWebhookService({
        claimEvent: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_new_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.claimEvent).toHaveBeenCalledWith(
        'evt_new_123',
        'checkout.session.completed',
      );
    });

    it('should fail with DuplicateWebhookError for completed event', async () => {
      const mockService = createTestWebhookService({
        claimEvent: vi.fn(() =>
          Effect.fail(
            new DuplicateWebhookError({
              eventId: 'evt_completed_123',
              processedAt: new Date(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_completed_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(DuplicateWebhookError);
          expect((error.error as DuplicateWebhookError).eventId).toBe('evt_completed_123');
        }
      }
    });

    it('should allow retry for failed event', async () => {
      let retryCount = 0;
      const mockService = createTestWebhookService({
        claimEvent: vi.fn(() => {
          retryCount++;
          return Effect.void;
        }),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_failed_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(retryCount).toBe(1);
    });

    it('should reclaim stale processing event (>5 min)', async () => {
      const mockService = createTestWebhookService({
        claimEvent: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_stale_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeUndefined();
    });

    it('should reject recent processing event as duplicate', async () => {
      const mockService = createTestWebhookService({
        claimEvent: vi.fn(() =>
          Effect.fail(
            new DuplicateWebhookError({
              eventId: 'evt_processing_123',
              processedAt: new Date(),
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_processing_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should fail with FirestoreError on transaction failure', async () => {
      const mockService = createTestWebhookService({
        claimEvent: vi.fn(() =>
          Effect.fail(
            new FirestoreError({
              code: 'CLAIM_WEBHOOK_EVENT_FAILED',
              message: 'Transaction failed',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.claimEvent('evt_123', 'checkout.session.completed');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(FirestoreError);
        }
      }
    });
  });

  describe('completeEvent', () => {
    it('should mark event as completed', async () => {
      const mockService = createTestWebhookService({
        completeEvent: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.completeEvent('evt_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.completeEvent).toHaveBeenCalledWith('evt_123');
    });

    it('should fail with FirestoreError on network error', async () => {
      const mockService = createTestWebhookService({
        completeEvent: vi.fn(() =>
          Effect.fail(
            new FirestoreError({
              code: 'COMPLETE_WEBHOOK_EVENT_FAILED',
              message: 'Network error',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.completeEvent('evt_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('failEvent', () => {
    it('should mark event as failed', async () => {
      const mockService = createTestWebhookService({
        failEvent: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.failEvent('evt_123', 'Processing error');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeUndefined();
      expect(mockService.failEvent).toHaveBeenCalledWith('evt_123', 'Processing error');
    });

    it('should store error message', async () => {
      const errorMessage = 'Payment processing failed';
      const mockService = createTestWebhookService({
        failEvent: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.failEvent('evt_123', errorMessage);
      });

      await Effect.runPromise(Effect.provide(program, TestWebhookLayer(mockService)));

      expect(mockService.failEvent).toHaveBeenCalledWith('evt_123', errorMessage);
    });
  });

  describe('cleanupOldEvents', () => {
    it('should delete events older than threshold', async () => {
      const mockService = createTestWebhookService({
        cleanupOldEvents: vi.fn(() => Effect.succeed(5)),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.cleanupOldEvents(30);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBe(5);
      expect(mockService.cleanupOldEvents).toHaveBeenCalledWith(30);
    });

    it('should return count of deleted events', async () => {
      const mockService = createTestWebhookService({
        cleanupOldEvents: vi.fn(() => Effect.succeed(10)),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.cleanupOldEvents(30);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBe(10);
    });

    it('should handle empty result', async () => {
      const mockService = createTestWebhookService({
        cleanupOldEvents: vi.fn(() => Effect.succeed(0)),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.cleanupOldEvents(30);
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBe(0);
    });
  });

  describe('checkEvent', () => {
    it('should return null for new event', async () => {
      const mockService = createTestWebhookService({
        checkEvent: vi.fn(() => Effect.succeed(null)),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.checkEvent('evt_new_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeNull();
    });

    it('should return event document if exists', async () => {
      const mockEvent = createMockWebhookEvent({
        id: 'evt_existing_123',
        status: 'completed',
      });
      const mockService = createTestWebhookService({
        checkEvent: vi.fn(() => Effect.succeed(mockEvent)),
      });

      const program = Effect.gen(function* () {
        const service = yield* WebhookIdempotencyService;
        return yield* service.checkEvent('evt_existing_123');
      });

      const result = await Effect.runPromise(
        Effect.provide(program, TestWebhookLayer(mockService)),
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('evt_existing_123');
      expect(result?.status).toBe('completed');
    });
  });
});

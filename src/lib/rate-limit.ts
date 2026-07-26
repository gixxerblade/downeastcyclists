import {createHmac} from 'node:crypto';

import {lt, sql} from 'drizzle-orm';

import {db} from '@/src/db/client';
import {rateLimitBuckets} from '@/src/db/schema';

export interface RateLimitRequest {
  readonly scope: string;
  readonly identifier: string;
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: Date;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
}

function getRateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET must be at least 32 characters');
  }
  return secret;
}

function identifierHash(identifier: string): string {
  return createHmac('sha256', getRateLimitSecret()).update(identifier).digest('hex');
}

export async function consumeRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
  now = new Date(),
}: RateLimitRequest): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const resetAt = new Date(windowStartMs + windowMs);
  const expiresAt = new Date(windowStartMs + windowMs * 2);
  const hash = identifierHash(identifier);

  // Keep the table bounded without relying on any one serverless instance.
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.expiresAt, now));

  const [bucket] = await db
    .insert(rateLimitBuckets)
    .values({
      scope,
      identifierHash: hash,
      windowStart,
      requestCount: 1,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.scope, rateLimitBuckets.identifierHash],
      set: {
        windowStart: sql`CASE
          WHEN ${rateLimitBuckets.windowStart} < ${windowStart}
          THEN ${windowStart}
          ELSE ${rateLimitBuckets.windowStart}
        END`,
        requestCount: sql`CASE
          WHEN ${rateLimitBuckets.windowStart} < ${windowStart}
          THEN 1
          ELSE ${rateLimitBuckets.requestCount} + 1
        END`,
        expiresAt,
      },
    })
    .returning({requestCount: rateLimitBuckets.requestCount});

  if (!bucket) {
    throw new Error('Rate-limit bucket was not returned');
  }

  return {
    allowed: bucket.requestCount <= limit,
    remaining: Math.max(0, limit - bucket.requestCount),
    resetAt,
  };
}

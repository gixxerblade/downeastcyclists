import {and, desc, eq, gte, ilike, lte, or, sql} from 'drizzle-orm';
import {Effect} from 'effect';

import {auditLog, emailLog, users} from '@/src/db/schema/tables';

import {resolveUserId} from './database.service';
import {DatabaseError} from './errors';

// Lazy db loader — avoids triggering Neon connection at import time
function getDb() {
  return (require('@/src/db/client') as typeof import('@/src/db/client')).db;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntryDocument {
  id: string;
  action: string;
  performedBy: string;
  performedByEmail: string | null;
  targetUserId?: string;
  targetEmail?: string;
  targetName?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface ActionLogParams {
  action?: string;
  actor?: string;
  target?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ActionLogResult {
  entries: AuditEntryDocument[];
  total: number;
}

export interface EmailLogDocument {
  id: string;
  emailType: string;
  deliveryType: string;
  campaignKey: string;
  recipientEmail: string;
  subject: string;
  status: string;
  idempotencyKey: string;
  sentBy: string;
  sentByEmail: string | null;
  errorMessage: string | null;
  timestamp: string;
}

export interface LogEmailEventInput {
  membershipId?: string;
  emailType: string;
  deliveryType: 'send' | 'resend' | 'automated';
  campaignKey: string;
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'failed';
  idempotencyKey: string;
  sentBy: string;
  sentByEmail?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Audit method implementations
// ---------------------------------------------------------------------------

export function createAuditMethods() {
  const db = getDb();
  return {
    logAuditEntry: (userId: string, action: string, details: Record<string, unknown>) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            // Extract performedBy from details, defaulting to the userId
            const performedBy = (details.performedBy as string) ?? userId;
            const performedByEmail = (details.performedByEmail as string) ?? null;

            await db.insert(auditLog).values({
              userId: userRow.id,
              action: action as typeof auditLog.$inferInsert.action,
              performedBy,
              performedByEmail,
              details,
              createdAt: new Date(),
            });
          },
          catch: (error) =>
            new DatabaseError({
              code: 'AUDIT_LOG_FAILED',
              message: `Failed to log audit entry for ${userId}`,
              cause: error,
            }),
        });
      }),

    getMemberAuditLog: (userId: string) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        return yield* Effect.tryPromise({
          try: async () => {
            const rows = await db
              .select({
                audit: auditLog,
                performerUser: users,
              })
              .from(auditLog)
              .leftJoin(users, eq(auditLog.userId, users.id))
              .where(eq(auditLog.userId, userRow.id))
              .orderBy(desc(auditLog.createdAt))
              .limit(100);

            return rows.map(
              (row): AuditEntryDocument => ({
                id: row.audit.id,
                action: row.audit.action,
                performedBy: row.audit.performedBy,
                performedByEmail: row.audit.performedByEmail ?? null,
                targetUserId: row.performerUser?.firebaseUid,
                targetEmail: row.performerUser?.email,
                targetName: row.performerUser?.name ?? undefined,
                details: (row.audit.details as Record<string, unknown>) ?? {},
                timestamp: row.audit.createdAt.toISOString(),
              }),
            );
          },
          catch: (error) =>
            new DatabaseError({
              code: 'GET_AUDIT_LOG_FAILED',
              message: `Failed to get audit log for user ${userId}`,
              cause: error,
            }),
        });
      }),

    getActionLog: (params: ActionLogParams) =>
      Effect.tryPromise({
        try: async () => {
          const conditions = [];

          if (params.action) {
            conditions.push(
              eq(auditLog.action, params.action as typeof auditLog.$inferSelect.action),
            );
          }

          if (params.actor) {
            const actorPattern = `%${params.actor}%`;
            conditions.push(
              or(
                ilike(auditLog.performedBy, actorPattern),
                ilike(auditLog.performedByEmail, actorPattern),
              ),
            );
          }

          if (params.target) {
            const targetPattern = `%${params.target}%`;
            conditions.push(
              or(ilike(users.email, targetPattern), ilike(users.name, targetPattern)),
            );
          }

          if (params.dateFrom) {
            conditions.push(gte(auditLog.createdAt, new Date(params.dateFrom)));
          }

          if (params.dateTo) {
            conditions.push(lte(auditLog.createdAt, new Date(params.dateTo)));
          }

          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const pageSize = params.pageSize || 50;
          const page = params.page || 1;
          const offset = (page - 1) * pageSize;

          const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(auditLog)
            .leftJoin(users, eq(auditLog.userId, users.id))
            .where(where);

          const rows = await db
            .select({
              audit: auditLog,
              targetUser: users,
            })
            .from(auditLog)
            .leftJoin(users, eq(auditLog.userId, users.id))
            .where(where)
            .orderBy(desc(auditLog.createdAt))
            .limit(pageSize)
            .offset(offset);

          return {
            total: countResult[0]?.count ?? 0,
            entries: rows.map(
              (row): AuditEntryDocument => ({
                id: row.audit.id,
                action: row.audit.action,
                performedBy: row.audit.performedBy,
                performedByEmail: row.audit.performedByEmail ?? null,
                targetUserId: row.targetUser?.firebaseUid,
                targetEmail: row.targetUser?.email,
                targetName: row.targetUser?.name ?? undefined,
                details: (row.audit.details as Record<string, unknown>) ?? {},
                timestamp: row.audit.createdAt.toISOString(),
              }),
            ),
          };
        },
        catch: (error) =>
          new DatabaseError({
            code: 'GET_ACTION_LOG_FAILED',
            message: 'Failed to get action log',
            cause: error,
          }),
      }),

    getLatestEmailLog: (userId: string, emailType: string, campaignKey: string) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        return yield* Effect.tryPromise({
          try: async () => {
            const row = await db
              .select()
              .from(emailLog)
              .where(
                and(
                  eq(emailLog.userId, userRow.id),
                  eq(emailLog.emailType, emailType),
                  eq(emailLog.campaignKey, campaignKey),
                  eq(emailLog.status, 'sent'),
                ),
              )
              .orderBy(desc(emailLog.createdAt))
              .limit(1)
              .then((rows) => rows[0] ?? null);

            if (!row) return null;
            return {
              id: row.id,
              emailType: row.emailType,
              deliveryType: row.deliveryType,
              campaignKey: row.campaignKey,
              recipientEmail: row.recipientEmail,
              subject: row.subject,
              status: row.status,
              idempotencyKey: row.idempotencyKey,
              sentBy: row.sentBy,
              sentByEmail: row.sentByEmail ?? null,
              errorMessage: row.errorMessage ?? null,
              timestamp: row.createdAt.toISOString(),
            };
          },
          catch: (error) =>
            new DatabaseError({
              code: 'GET_LATEST_EMAIL_LOG_FAILED',
              message: `Failed to get latest ${emailType} email log for ${userId}`,
              cause: error,
            }),
        });
      }),

    logEmailEvent: (userId: string, input: LogEmailEventInput) =>
      Effect.gen(function* () {
        const userRow = yield* resolveUserId(userId);

        yield* Effect.tryPromise({
          try: async () => {
            await db.insert(emailLog).values({
              userId: userRow.id,
              membershipId: input.membershipId ?? null,
              emailType: input.emailType,
              deliveryType: input.deliveryType,
              campaignKey: input.campaignKey,
              recipientEmail: input.recipientEmail,
              subject: input.subject,
              status: input.status,
              idempotencyKey: input.idempotencyKey,
              sentBy: input.sentBy,
              sentByEmail: input.sentByEmail ?? null,
              errorMessage: input.errorMessage ?? null,
              createdAt: new Date(),
            });
          },
          catch: (error) =>
            new DatabaseError({
              code: 'LOG_EMAIL_EVENT_FAILED',
              message: `Failed to log ${input.emailType} email event for ${userId}`,
              cause: error,
            }),
        });
      }),
  };
}

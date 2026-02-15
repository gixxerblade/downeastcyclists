import {desc, eq} from 'drizzle-orm';
import {Effect} from 'effect';

import {db} from '@/src/db/client';
import {auditLog, users} from '@/src/db/schema/tables';

import {resolveUserId} from './database.service';
import {DatabaseError} from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntryDocument {
  id: string;
  action: string;
  performedBy: string;
  performedByEmail: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Audit method implementations
// ---------------------------------------------------------------------------

export function createAuditMethods() {
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
                details: row.audit.details ?? null,
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
  };
}

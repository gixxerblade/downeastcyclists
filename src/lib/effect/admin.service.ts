import {Context, Effect, Layer, pipe} from 'effect';

import {AuthService} from './auth.service';
import {
  AdminError,
  FirestoreError,
  NotFoundError,
  UnauthorizedError,
  SessionError,
  AuthError,
} from './errors';
import {FirestoreService} from './firestore.service';
import type {MembershipAdjustment, MemberWithMembership, MemberSearchParams} from './schemas';
import {StatsService} from './stats.service';

// Service interface
export interface AdminService {
  readonly verifyAdmin: (
    sessionCookie: string,
  ) => Effect.Effect<{uid: string; email?: string}, UnauthorizedError | SessionError | AuthError>;

  readonly setAdminRole: (
    adminSessionCookie: string,
    targetUid: string,
    isAdmin: boolean,
  ) => Effect.Effect<
    void,
    UnauthorizedError | AdminError | SessionError | AuthError | FirestoreError
  >;

  readonly searchMembers: (
    params: MemberSearchParams,
  ) => Effect.Effect<{members: MemberWithMembership[]; total: number}, FirestoreError>;

  readonly getMember: (
    userId: string,
  ) => Effect.Effect<MemberWithMembership, FirestoreError | NotFoundError>;

  readonly adjustMembership: (
    adminUid: string,
    adjustment: MembershipAdjustment,
  ) => Effect.Effect<void, FirestoreError | NotFoundError | AdminError>;
}

// Service tag
export const AdminService = Context.GenericTag<AdminService>('AdminService');

// Implementation
const make = Effect.gen(function* () {
  const auth = yield* AuthService;
  const firestore = yield* FirestoreService;
  const stats = yield* StatsService;

  return AdminService.of({
    // Verify admin access
    verifyAdmin: (sessionCookie) =>
      pipe(
        auth.verifyAdminClaim(sessionCookie),
        Effect.flatMap((session) =>
          session.isAdmin
            ? Effect.succeed({uid: session.uid, email: session.email})
            : Effect.fail(
                new UnauthorizedError({
                  message: 'Admin access required',
                }),
              ),
        ),
      ),

    // Set admin role for a user
    setAdminRole: (adminSessionCookie, targetUid, isAdmin) =>
      Effect.gen(function* () {
        // Verify caller is admin
        const admin = yield* pipe(
          auth.verifyAdminClaim(adminSessionCookie),
          Effect.flatMap((session) =>
            session.isAdmin
              ? Effect.succeed(session)
              : Effect.fail(new UnauthorizedError({message: 'Admin access required'})),
          ),
        );

        // Set custom claim
        yield* auth.setCustomClaims(targetUid, {admin: isAdmin});

        // Log the action
        yield* firestore.logAuditEntry(targetUid, 'ADMIN_ROLE_CHANGE', {
          changedBy: admin.uid,
          newValue: isAdmin,
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(
          `Admin role ${isAdmin ? 'granted to' : 'revoked from'} ${targetUid} by ${admin.uid}`,
        );
      }),

    // Search members
    searchMembers: (params) => firestore.getAllMemberships(params),

    // Get single member
    getMember: (userId) =>
      Effect.gen(function* () {
        const user = yield* firestore.getUser(userId);

        if (!user) {
          return yield* Effect.fail(new NotFoundError({resource: 'user', id: userId}));
        }

        const membership = yield* firestore.getActiveMembership(userId);
        const card = yield* firestore.getMembershipCard(userId);

        return {user, membership, card};
      }),

    // Adjust membership (admin override)
    adjustMembership: (adminUid, adjustment) =>
      Effect.gen(function* () {
        const {userId, membershipId, newEndDate, newStatus, reason} = adjustment;

        // Verify membership exists
        const membership = yield* firestore.getMembership(userId, membershipId);

        if (!membership) {
          return yield* Effect.fail(new NotFoundError({resource: 'membership', id: membershipId}));
        }

        // Prepare update
        const updateData: Record<string, unknown> = {};

        if (newEndDate) {
          updateData.endDate = new Date(newEndDate);
        }

        if (newStatus) {
          updateData.status = newStatus;

          // Update stats if status changed
          if (membership.status !== newStatus) {
            if (newStatus === 'active') {
              yield* stats.incrementStat('activeMembers');
              if (membership.status === 'canceled') {
                yield* stats.decrementStat('canceledMembers');
              }
            } else if (newStatus === 'canceled') {
              yield* stats.incrementStat('canceledMembers');
              if (membership.status === 'active') {
                yield* stats.decrementStat('activeMembers');
              }
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          return yield* Effect.fail(
            new AdminError({
              code: 'NO_CHANGES',
              message: 'No changes specified',
            }),
          );
        }

        // Apply update
        yield* firestore.updateMembership(userId, membershipId, updateData);

        // Log audit entry
        yield* firestore.logAuditEntry(userId, 'MEMBERSHIP_ADJUSTMENT', {
          adjustedBy: adminUid,
          membershipId,
          changes: updateData,
          reason,
          previousValues: {
            status: membership.status,
            endDate: membership.endDate,
          },
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(`Membership ${membershipId} adjusted by admin ${adminUid}: ${reason}`);
      }),
  });
});

// Live layer
export const AdminServiceLive = Layer.effect(AdminService, make);

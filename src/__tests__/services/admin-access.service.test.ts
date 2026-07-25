import {Effect, Layer} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {AdminService, AdminServiceLive} from '@/src/lib/effect/admin.service';
import {MembershipCardService} from '@/src/lib/effect/card.service';
import {StatsService} from '@/src/lib/effect/stats.service';

import {
  createTestAuthService,
  createTestCardService,
  createTestDatabaseService,
  createTestEmailService,
  createTestStripeService,
  TestAuthLayer,
  TestDatabaseLayer,
  TestEmailLayer,
  TestStripeLayer,
} from '../layers/test-layers';
import {createMockMembershipDocument, createMockUserDocument} from '../mocks/database.mock';

const stats = {
  totalMembers: 0,
  activeMembers: 0,
  expiredMembers: 0,
  canceledMembers: 0,
  individualCount: 0,
  familyCount: 0,
  monthlyRevenue: 0,
  yearlyRevenue: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeLayer(
  authService: ReturnType<typeof createTestAuthService>,
  databaseService: ReturnType<typeof createTestDatabaseService>,
  emailService = createTestEmailService(),
) {
  const statsService = StatsService.of({
    getStats: () => Effect.succeed(stats),
    refreshStats: () => Effect.succeed(stats),
    incrementStat: () => Effect.void,
    decrementStat: () => Effect.void,
  });

  return Layer.mergeAll(
    TestAuthLayer(authService),
    TestDatabaseLayer(databaseService),
    TestStripeLayer(createTestStripeService()),
    Layer.succeed(MembershipCardService, createTestCardService()),
    Layer.succeed(StatsService, statsService),
    TestEmailLayer(emailService),
  );
}

function runWithAdminService<A, E>(
  program: Effect.Effect<A, E, AdminService>,
  authService: ReturnType<typeof createTestAuthService>,
  databaseService: ReturnType<typeof createTestDatabaseService>,
  emailService = createTestEmailService(),
) {
  return Effect.runPromise(
    program.pipe(
      Effect.provide(AdminServiceLive),
      Effect.provide(makeLayer(authService, databaseService, emailService)),
    ),
  );
}

describe('AdminService access control', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
  });

  it('recognizes only the configured claimed account as administrator', async () => {
    const getUser = vi.fn(() => Effect.succeed(null));
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'admin_uid', email: 'admin@example.com', isAdmin: true}),
    });
    const databaseService = createTestDatabaseService({getUser});

    const access = await runWithAdminService(
      Effect.flatMap(AdminService, (service) => service.getAccess('session')),
      authService,
      databaseService,
    );

    expect(access.role).toBe('admin');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('does not treat a different claimed account as administrator', async () => {
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'other_uid', email: 'other@example.com', isAdmin: true}),
    });
    const databaseService = createTestDatabaseService({
      getUser: () => Effect.succeed(createMockUserDocument({id: 'other_uid', isOrganizer: false})),
    });

    const access = await runWithAdminService(
      Effect.flatMap(AdminService, (service) => service.getAccess('session')),
      authService,
      databaseService,
    );

    expect(access.role).toBe('member');
  });

  it('allows organizers reporting access but denies reconciliation', async () => {
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'organizer_uid', email: 'org@example.com', isAdmin: false}),
    });
    const databaseService = createTestDatabaseService({
      getUser: () =>
        Effect.succeed(createMockUserDocument({id: 'organizer_uid', isOrganizer: true})),
      getActiveMembership: () => Effect.succeed(createMockMembershipDocument()),
    });

    const allowed = await runWithAdminService(
      Effect.flatMap(AdminService, (service) => service.authorize('session', 'members:read')),
      authService,
      databaseService,
    );
    const denied = await Effect.runPromiseExit(
      Effect.flatMap(AdminService, (service) =>
        service.authorize('session', 'reconciliation:run'),
      ).pipe(
        Effect.provide(AdminServiceLive),
        Effect.provide(makeLayer(authService, databaseService)),
      ),
    );

    expect(allowed.role).toBe('organizer');
    expect(denied._tag).toBe('Failure');
  });

  it('removes dashboard access when an organizer membership is no longer current', async () => {
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'organizer_uid', email: 'org@example.com', isAdmin: false}),
    });
    const databaseService = createTestDatabaseService({
      getUser: () =>
        Effect.succeed(createMockUserDocument({id: 'organizer_uid', isOrganizer: true})),
      getActiveMembership: () => Effect.succeed(createMockMembershipDocument({status: 'past_due'})),
    });

    const access = await runWithAdminService(
      Effect.flatMap(AdminService, (service) => service.getAccess('session')),
      authService,
      databaseService,
    );

    expect(access.role).toBe('member');
  });

  it('lets the administrator grant organizer access and records the change', async () => {
    const updateUser = vi.fn(() => Effect.void);
    const logAuditEntry = vi.fn(() => Effect.void);
    const emailService = createTestEmailService();
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'admin_uid', email: 'admin@example.com', isAdmin: true}),
    });
    const databaseService = createTestDatabaseService({
      getUser: () => Effect.succeed(createMockUserDocument({id: 'member_uid'})),
      getActiveMembership: () => Effect.succeed(createMockMembershipDocument()),
      updateUser,
      logAuditEntry,
    });

    await runWithAdminService(
      Effect.flatMap(AdminService, (service) =>
        service.setOrganizerRole('session', 'member_uid', true),
      ),
      authService,
      databaseService,
      emailService,
    );

    expect(updateUser).toHaveBeenCalledWith('member_uid', {isOrganizer: true});
    expect(logAuditEntry).toHaveBeenCalledWith(
      'member_uid',
      'ADMIN_ROLE_CHANGE',
      expect.objectContaining({
        performedBy: 'admin_uid',
        performedByEmail: 'admin@example.com',
        role: 'organizer',
        newValue: true,
      }),
    );
    expect(emailService.sendOrganizerAccessGrantedEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      name: 'Test User',
      loginUrl: 'http://localhost:3000/login',
      dashboardUrl: 'http://localhost:3000/dashboard',
      grantedByName: 'admin@example.com',
      supportEmail: 'admin@example.com',
      idempotencyKey: 'organizer-access-granted/member_uid',
    });
  });

  it('does not resend organizer access email when the member is already an organizer', async () => {
    const emailService = createTestEmailService();
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'admin_uid', email: 'admin@example.com', isAdmin: true}),
    });
    const databaseService = createTestDatabaseService({
      getUser: () => Effect.succeed(createMockUserDocument({id: 'member_uid', isOrganizer: true})),
      getActiveMembership: () => Effect.succeed(createMockMembershipDocument()),
    });

    await runWithAdminService(
      Effect.flatMap(AdminService, (service) =>
        service.setOrganizerRole('session', 'member_uid', true),
      ),
      authService,
      databaseService,
      emailService,
    );

    expect(emailService.sendOrganizerAccessGrantedEmail).not.toHaveBeenCalled();
  });

  it('rejects organizer grants for members without a current membership', async () => {
    const updateUser = vi.fn(() => Effect.void);
    const authService = createTestAuthService({
      verifyAdminClaim: () =>
        Effect.succeed({uid: 'admin_uid', email: 'admin@example.com', isAdmin: true}),
    });
    const databaseService = createTestDatabaseService({
      getUser: () => Effect.succeed(createMockUserDocument({id: 'member_uid'})),
      getActiveMembership: () => Effect.succeed(null),
      updateUser,
    });

    const result = await Effect.runPromiseExit(
      Effect.flatMap(AdminService, (service) =>
        service.setOrganizerRole('session', 'member_uid', true),
      ).pipe(
        Effect.provide(AdminServiceLive),
        Effect.provide(makeLayer(authService, databaseService)),
      ),
    );

    expect(result._tag).toBe('Failure');
    expect(updateUser).not.toHaveBeenCalled();
  });
});

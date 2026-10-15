import {randomUUID} from 'node:crypto';

import {eq} from 'drizzle-orm';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {Effect} from 'effect';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import * as tables from '@/src/db/schema/tables';
import {createAuditMethods, type EmailLogDocument} from '@/src/lib/effect/database-audit.methods';
import {createMembershipMethods} from '@/src/lib/effect/database-membership.methods';
import {DatabaseService} from '@/src/lib/effect/database.service';
import {EmailService} from '@/src/lib/effect/email.service';
import {EmailError} from '@/src/lib/effect/errors';
import type {WaiverSignatureInput} from '@/src/lib/waivers/schemas';

import {createTestDatabaseService, createTestEmailService} from '../layers/test-layers';

const fixture = await vi.hoisted(async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const {drizzle} = await import('drizzle-orm/pglite');
  const schema = await import('@/src/db/schema');
  const client = new PGlite();
  const database = drizzle(client, {schema});
  return {client, database};
});
vi.mock('@/src/db/client', () => ({db: fixture.database}));

import {
  createWaiverTemplate,
  getMemberWaiverContext,
  getRequiredMembershipWaivers,
  getWaiverCompletion,
  hasSignedRequiredMembershipWaiver,
  listMemberWaivers,
  sendUnsignedWaiverEmails,
  previewWaiverEmail,
  sendTestWaiverEmail,
  signWaiver,
  updateWaiverTemplateStatus,
} from '@/src/lib/waivers/service';

const now = new Date('2026-10-14T12:00:00Z');
const logs = new Map<string, EmailLogDocument>();
const attempts: Array<EmailLogDocument & {userId: string}> = [];
const methods = createMembershipMethods(fixture.database);
const database = createTestDatabaseService({
  getActiveMembership: methods.getActiveMembership,
  getCurrentMemberContacts: methods.getCurrentMemberContacts,
  getLatestEmailLog: (uid, type, campaign) =>
    Effect.succeed(logs.get(`${uid}/${type}/${campaign}`) ?? null),
  getEmailCampaignStatuses: (type, campaign) =>
    Effect.succeed(
      attempts
        .filter((event) => event.emailType === type && event.campaignKey === campaign)
        .toReversed(),
    ),
  logEmailEvent: (uid, event) =>
    Effect.sync(() => {
      const record = {
        ...event,
        id: randomUUID(),
        sentByEmail: event.sentByEmail ?? null,
        errorMessage: event.errorMessage ?? null,
        timestamp: now.toISOString(),
      };
      attempts.push({...record, userId: uid});
      if (event.status === 'sent')
        logs.set(`${uid}/${event.emailType}/${event.campaignKey}`, record);
    }),
});
const email = createTestEmailService();
function run<A, E>(program: Effect.Effect<A, E, DatabaseService | EmailService>) {
  return Effect.runPromise(
    program.pipe(
      Effect.provideService(DatabaseService, database),
      Effect.provideService(EmailService, email),
    ),
  );
}
const signature: WaiverSignatureInput = {
  signerRole: 'household',
  signerName: 'Alex Rider',
  signerBirthDate: '1980-01-01',
  familyMembers: [{name: 'Sam Rider', birthDate: '2015-01-01'}],
  phone: '555-555-0100',
  addressStreet: '1 Test St',
  addressCity: 'Jacksonville',
  addressState: 'NC',
  addressZip: '28540',
  signatureText: 'Alex Rider',
  consent: true,
};
const evidence = {ipAddress: '192.0.2.1', userAgent: 'Synthetic test'};
const terms = {
  title: 'Club waiver',
  scope: 'membership',
  content: 'Approved terms',
  acknowledgment: 'I agree',
  isRequired: true,
} satisfies Parameters<typeof createWaiverTemplate>[0];

async function template(overrides: Partial<Parameters<typeof createWaiverTemplate>[0]> = {}) {
  return run(createWaiverTemplate({...terms, ...overrides}, 'admin-test'));
}
async function member(
  uid: string,
  status: typeof tables.memberships.$inferInsert.status = 'active',
  planType: 'individual' | 'family' = 'family',
  expired = false,
) {
  const [user] = await fixture.database
    .insert(tables.users)
    .values({firebaseUid: uid, email: `${uid}@example.test`, name: 'Alex Rider'})
    .returning();
  await fixture.database.insert(tables.memberships).values({
    userId: user.id,
    status,
    planType,
    startDate: new Date('2025-01-01'),
    endDate: new Date(expired ? '2026-01-01' : '2027-01-01'),
  });
  return user;
}
function sign(uid: string, templateId: string, input = signature) {
  return run(signWaiver(uid, `${uid}@example.test`, templateId, input, evidence));
}

beforeAll(async () => {
  await migrate(fixture.database, {migrationsFolder: 'drizzle'});
}, 30_000);
beforeEach(async () => {
  vi.useFakeTimers({toFake: ['Date']});
  vi.setSystemTime(now);
  vi.stubEnv('WAIVER_SIGNATURE_SECRET', 'synthetic-waiver-secret-at-least-32-characters');
  await fixture.client.exec('TRUNCATE waiver_signatures, waiver_templates, users CASCADE');
  logs.clear();
  attempts.length = 0;
  vi.clearAllMocks();
  vi.mocked(email.ensureWaiverEmailConfigured).mockReturnValue(Effect.void);
  vi.mocked(email.sendWaiverSignatureRequestEmail).mockReturnValue(Effect.void);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
afterAll(() => fixture.client.close());

describe('waiver rollout regression coverage', () => {
  it('reads the latest success and failure per member without mixing campaigns or email types', async () => {
    const first = await member('first');
    const second = await member('second');
    const base = {
      emailType: 'liability_waiver_signature_request',
      campaignKey: 'waiver/test',
      deliveryType: 'one-time',
      recipientEmail: 'synthetic@example.test',
      subject: 'Test',
      idempotencyKey: 'synthetic',
      sentBy: 'admin',
    };
    const rows = await fixture.database
      .insert(tables.emailLog)
      .values([
        {...base, userId: first.id, status: 'sent', createdAt: new Date('2026-10-01')},
        {...base, userId: first.id, status: 'sent', createdAt: new Date('2026-10-02')},
        {...base, userId: first.id, status: 'failed', createdAt: new Date('2026-10-03')},
        {...base, userId: second.id, status: 'failed', createdAt: new Date('2026-10-02')},
        {...base, userId: first.id, status: 'sent', campaignKey: 'waiver/other'},
        {...base, userId: first.id, status: 'sent', emailType: 'renewal'},
      ])
      .returning();
    const statuses = await Effect.runPromise(
      createAuditMethods(fixture.database).getEmailCampaignStatuses(
        base.emailType,
        base.campaignKey,
      ),
    );
    expect(statuses).toHaveLength(3);
    expect(statuses).toEqual(
      expect.arrayContaining([
        {userId: 'first', id: rows[1].id, status: 'sent', timestamp: '2026-10-02T00:00:00.000Z'},
        {userId: 'first', id: rows[2].id, status: 'failed', timestamp: '2026-10-03T00:00:00.000Z'},
        {userId: 'second', id: rows[3].id, status: 'failed', timestamp: '2026-10-02T00:00:00.000Z'},
      ]),
    );
  });

  it('sends only to selected members, deduplicates selection, and keeps all other invitations available', async () => {
    await member('selected');
    await member('other');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    const selection = {
      action: 'invite',
      templateId: waiver.id,
      userIds: ['selected', 'selected'],
    } satisfies Parameters<typeof sendUnsignedWaiverEmails>[3];
    expect(
      await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, selection)),
    ).toMatchObject({sent: 1, failed: 0});
    const report = await run(getWaiverCompletion(waiver.id));
    expect(report.members.find((row) => row.userId === 'selected')).toMatchObject({
      canInvite: false,
      canRemind: true,
      lastEmailStatus: 'sent',
    });
    expect(report.members.find((row) => row.userId === 'other')).toMatchObject({
      canInvite: true,
      canRemind: false,
      lastEmailId: null,
    });
    expect(
      await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, selection)),
    ).toMatchObject({sent: 0, skipped: 1});
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown selection before sending and skips a member who signed after selection', async () => {
    await member('rider');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    await expect(
      run(
        sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, {
          action: 'invite',
          templateId: waiver.id,
          userIds: ['rider', 'unknown'],
        }),
      ),
    ).rejects.toThrow('list has changed');
    expect(email.sendWaiverSignatureRequestEmail).not.toHaveBeenCalled();
    await sign('rider', waiver.id);
    expect(
      await run(
        sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, {
          action: 'invite',
          templateId: waiver.id,
          userIds: ['rider'],
        }),
      ),
    ).toMatchObject({sent: 0, skipped: 1});
  });

  it('requires a matching prior send for a reminder and skips replayed or stale confirmations', async () => {
    await member('rider');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    const reminder = (previousEmailId: string) =>
      ({
        action: 'remind',
        templateId: waiver.id,
        confirmed: true,
        recipients: [{userId: 'rider', previousEmailId}],
      }) satisfies Parameters<typeof sendUnsignedWaiverEmails>[3];
    expect(
      await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, reminder(randomUUID()))),
    ).toMatchObject({sent: 0, skipped: 1});
    await run(sendUnsignedWaiverEmails(waiver.id, 'admin'));
    const previous = attempts[0].id;
    await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, reminder(previous)));
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reminder: true,
        idempotencyKey: `waiver-reminder/${waiver.id}/rider/${previous}`,
      }),
    );
    expect(attempts[1]).toMatchObject({deliveryType: 'resend'});
    expect(
      await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, reminder(previous))),
    ).toMatchObject({sent: 0, skipped: 1});
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenCalledTimes(2);
  });

  it('retries a failed reminder with the same key and preserves the previous successful invitation', async () => {
    await member('rider');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    await run(sendUnsignedWaiverEmails(waiver.id, 'admin'));
    const prior = attempts[0].id;
    const selection = {
      action: 'remind',
      templateId: waiver.id,
      confirmed: true,
      recipients: [{userId: 'rider', previousEmailId: prior}],
    } satisfies Parameters<typeof sendUnsignedWaiverEmails>[3];
    vi.mocked(email.sendWaiverSignatureRequestEmail).mockReturnValueOnce(
      Effect.fail(new EmailError({code: 'TEST', message: 'Transient failure'})),
    );
    expect(
      await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, selection)),
    ).toMatchObject({failed: 1});
    expect((await run(getWaiverCompletion(waiver.id))).members[0]).toMatchObject({
      lastEmailId: prior,
      canInvite: false,
      canRemind: true,
      lastEmailStatus: 'failed',
    });
    expect(
      await run(sendUnsignedWaiverEmails(waiver.id, 'admin', undefined, selection)),
    ).toMatchObject({sent: 1});
    const calls = vi.mocked(email.sendWaiverSignatureRequestEmail).mock.calls;
    expect(calls[1][0].idempotencyKey).toBe(calls[2][0].idempotencyKey);
  });

  it('previews without sending and sends tests only to the administrative identity without consuming a member invitation', async () => {
    await member('rider');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    const preview = await run(previewWaiverEmail(waiver.id, 'system@example.test'));
    expect(preview.testRecipient).toBe('system@example.test');
    expect(email.sendWaiverSignatureRequestEmail).not.toHaveBeenCalled();
    await run(
      sendTestWaiverEmail(waiver.id, {uid: 'admin', email: 'system@example.test'}, randomUUID()),
    );
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({to: 'system@example.test', test: true}),
    );
    expect(attempts).toHaveLength(0);
    expect((await run(getWaiverCompletion(waiver.id))).members[0].canInvite).toBe(true);
  });
  it('excludes the administrative account but requires an organizer member to sign', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'system@example.test');
    await member('system');
    const organizer = await member('organizer');
    await fixture.database
      .update(tables.users)
      .set({isOrganizer: true})
      .where(eq(tables.users.id, organizer.id));
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    const completion = await run(getWaiverCompletion(waiver.id));
    expect(completion.pending).toBe(1);
    expect(completion.members.map((row) => row.userId)).toEqual(['organizer']);
    await expect(run(getMemberWaiverContext('system', 'system@example.test'))).rejects.toThrow(
      'not a member account',
    );
    await expect(sign('system', waiver.id)).rejects.toThrow('cannot sign waivers');
    expect(await run(sendUnsignedWaiverEmails(waiver.id, 'system'))).toMatchObject({
      sent: 1,
      failed: 0,
    });
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({to: 'organizer@example.test'}),
    );
    expect(await run(getMemberWaiverContext('organizer', 'organizer@example.test'))).toMatchObject({
      hasPendingRequired: true,
    });
    await sign('organizer', waiver.id);
    expect(await run(getMemberWaiverContext('organizer', 'organizer@example.test'))).toMatchObject({
      hasPendingRequired: false,
    });
    expect(await run(hasSignedRequiredMembershipWaiver('system'))).toBe(false);
  });

  it('includes past-due, imported, and complimentary members but excludes expired members', async () => {
    for (const status of [
      'active',
      'trialing',
      'past_due',
      'legacy',
      'complimentary',
    ] satisfies Array<typeof tables.memberships.$inferInsert.status>)
      await member(status, status);
    await member('expired', 'active', 'family', true);
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    const completion = await run(getWaiverCompletion(waiver.id));
    expect(completion.pending).toBe(5);
    expect(completion.members.map((row) => row.userId).sort()).toEqual([
      'active',
      'complimentary',
      'legacy',
      'past_due',
      'trialing',
    ]);
    for (const uid of ['legacy', 'complimentary']) {
      expect(await run(getMemberWaiverContext(uid, `${uid}@example.test`))).toMatchObject({
        requireHousehold: true,
        hasPendingRequired: true,
      });
      await expect(
        sign(uid, waiver.id, {...signature, signerRole: 'adult', familyMembers: []}),
      ).rejects.toThrow('household signature');
      await sign(uid, waiver.id);
      expect(await run(getMemberWaiverContext(uid, `${uid}@example.test`))).toMatchObject({
        hasPendingRequired: false,
      });
    }
  });

  it('returns every required form and requires every signature before checkout', async () => {
    await member('new-member', 'active', 'individual');
    const first = await template();
    const second = await template({title: 'Additional required waiver'});
    await run(updateWaiverTemplateStatus(first.id, 'publish'));
    await run(updateWaiverTemplateStatus(second.id, 'publish'));
    expect(await run(getRequiredMembershipWaivers())).toHaveLength(2);
    await sign('new-member', first.id);
    expect(await run(hasSignedRequiredMembershipWaiver('new-member'))).toBe(false);
    await sign('new-member', second.id);
    expect(await run(hasSignedRequiredMembershipWaiver('new-member'))).toBe(true);
  });

  it('keeps the current waiver signable until a scheduled replacement takes effect', async () => {
    await member('rider');
    const first = await template();
    await run(updateWaiverTemplateStatus(first.id, 'publish'));
    const next = await template({effectiveFrom: '2026-11-01T00:00:00Z'});
    await run(updateWaiverTemplateStatus(next.id, 'publish'));
    expect((await run(getRequiredMembershipWaivers())).map((row) => row.id)).toEqual([first.id]);
    await sign('rider', first.id);
    await expect(sign('rider', next.id)).rejects.toThrow('no longer available');
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    expect((await run(getRequiredMembershipWaivers())).map((row) => row.id)).toEqual([next.id]);
    await expect(sign('rider', first.id)).rejects.toThrow('no longer available');
    await sign('rider', next.id);
    const records = await run(listMemberWaivers('rider'));
    expect(records.find((row) => row.id === first.id)).toMatchObject({
      isActive: false,
      isSigned: true,
    });
  });

  it('leaves the current waiver available when publication fails', async () => {
    const first = await template();
    await run(updateWaiverTemplateStatus(first.id, 'publish'));
    const next = await template({effectiveFrom: '2026-11-01T00:00:00Z'});
    const update = vi.spyOn(fixture.database, 'update').mockImplementationOnce(() => {
      throw new Error('Simulated publication failure');
    });
    await expect(run(updateWaiverTemplateStatus(next.id, 'publish'))).rejects.toThrow(
      'update template',
    );
    update.mockRestore();
    const [original] = await fixture.database
      .select()
      .from(tables.waiverTemplates)
      .where(eq(tables.waiverTemplates.id, first.id));
    expect(original.expiresAt).toBeNull();
    expect((await run(getRequiredMembershipWaivers())).map((row) => row.id)).toEqual([first.id]);
  });

  it('leaves the current waiver available after canceling a scheduled replacement', async () => {
    const first = await template();
    await run(updateWaiverTemplateStatus(first.id, 'publish'));
    const next = await template({effectiveFrom: '2026-11-01T00:00:00Z'});
    await run(updateWaiverTemplateStatus(next.id, 'publish'));
    await run(updateWaiverTemplateStatus(next.id, 'retire'));
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    expect((await run(getRequiredMembershipWaivers())).map((row) => row.id)).toEqual([first.id]);
  });

  it('does not revive superseded wording when the replacement expires or is retired', async () => {
    const first = await template();
    await run(updateWaiverTemplateStatus(first.id, 'publish'));
    const next = await template({expiresAt: '2026-11-01T00:00:00Z'});
    await run(updateWaiverTemplateStatus(next.id, 'publish'));
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    expect(await run(getRequiredMembershipWaivers())).toHaveLength(0);
    await run(updateWaiverTemplateStatus(next.id, 'retire'));
    expect(await run(getRequiredMembershipWaivers())).toHaveLength(0);
  });

  it('preserves all signed copies after retirement and membership expiration', async () => {
    const user = await member('former');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    const first = await sign('former', waiver.id);
    await sign('former', waiver.id, {
      ...signature,
      previousSignatureId: first.id,
      phone: '555-555-0101',
    });
    await run(updateWaiverTemplateStatus(waiver.id, 'retire'));
    await fixture.database
      .update(tables.memberships)
      .set({endDate: new Date('2026-01-01')})
      .where(eq(tables.memberships.userId, user.id));
    const own = await run(listMemberWaivers('former'));
    expect(own[0]).toMatchObject({isSigned: true, isActive: false});
    expect(own[0].history).toHaveLength(2);
    const report = await run(getWaiverCompletion(waiver.id));
    expect(report).toMatchObject({signed: 0, pending: 0});
    expect(report.members[0]).toMatchObject({isCurrent: false});
    expect(report.members[0].history).toHaveLength(2);
  });

  it('rejects draft, scheduled, retired, and expired invitation campaigns without consuming sends', async () => {
    await member('rider');
    const draft = await template();
    const future = await template({title: 'Future', effectiveFrom: '2027-01-01'});
    await run(updateWaiverTemplateStatus(future.id, 'publish'));
    const retired = await template({title: 'Retired'});
    await run(updateWaiverTemplateStatus(retired.id, 'publish'));
    await run(updateWaiverTemplateStatus(retired.id, 'retire'));
    const expired = await template({title: 'Expired', expiresAt: '2026-10-15'});
    await run(updateWaiverTemplateStatus(expired.id, 'publish'));
    vi.setSystemTime(new Date('2026-10-16'));
    for (const waiver of [draft, future, retired, expired])
      await expect(run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).rejects.toThrow(
        'currently available',
      );
    expect(email.sendWaiverSignatureRequestEmail).not.toHaveBeenCalled();
    expect(logs.size).toBe(0);
  });

  it('does not consume the campaign when email configuration is missing', async () => {
    await member('rider');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    vi.mocked(email.ensureWaiverEmailConfigured).mockReturnValue(
      Effect.fail(
        new EmailError({
          code: 'WAIVER_EMAIL_NOT_CONFIGURED',
          message: 'Missing email configuration',
        }),
      ),
    );
    await expect(run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).rejects.toThrow(
      'Missing email configuration',
    );
    expect(logs.size).toBe(0);
    vi.mocked(email.ensureWaiverEmailConfigured).mockReturnValue(Effect.void);
    expect(await run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).toMatchObject({
      sent: 1,
      failed: 0,
    });
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        signUrl: expect.stringContaining(`/waivers?templateId=${waiver.id}`),
      }),
    );
    expect(await run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).toMatchObject({
      sent: 0,
      skipped: 1,
    });
    expect(email.sendWaiverSignatureRequestEmail).toHaveBeenCalledTimes(1);
  });

  it('retries failed sends without re-emailing successful recipients', async () => {
    await member('rider');
    const waiver = await template();
    await run(updateWaiverTemplateStatus(waiver.id, 'publish'));
    vi.mocked(email.sendWaiverSignatureRequestEmail).mockReturnValueOnce(
      Effect.fail(new EmailError({code: 'SEND_FAILED', message: 'Transient provider failure'})),
    );
    expect(await run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).toMatchObject({
      sent: 0,
      failed: 1,
    });
    expect(await run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).toMatchObject({
      sent: 1,
      failed: 0,
    });
    expect(await run(sendUnsignedWaiverEmails(waiver.id, 'admin'))).toMatchObject({
      sent: 0,
      skipped: 1,
    });
  });
});

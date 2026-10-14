import {eq} from 'drizzle-orm';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {Effect} from 'effect';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import * as tables from '@/src/db/schema/tables';
import type {EmailLogDocument} from '@/src/lib/effect/database-audit.methods';
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
  signWaiver,
  updateWaiverTemplateStatus,
} from '@/src/lib/waivers/service';

const now = new Date('2026-10-14T12:00:00Z');
const logs = new Map<string, EmailLogDocument>();
const methods = createMembershipMethods(fixture.database);
const database = createTestDatabaseService({
  getActiveMembership: methods.getActiveMembership,
  getCurrentMemberContacts: methods.getCurrentMemberContacts,
  getLatestEmailLog: (uid, type, campaign) =>
    Effect.succeed(logs.get(`${uid}/${type}/${campaign}`) ?? null),
  logEmailEvent: (uid, event) =>
    Effect.sync(() => {
      logs.set(`${uid}/${event.emailType}/${event.campaignKey}`, {
        ...event,
        id: 'synthetic-log',
        sentByEmail: event.sentByEmail ?? null,
        errorMessage: event.errorMessage ?? null,
        timestamp: now.toISOString(),
      });
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
      expect(await run(getMemberWaiverContext(uid))).toMatchObject({
        requireHousehold: true,
        hasPendingRequired: true,
      });
      await expect(
        sign(uid, waiver.id, {...signature, signerRole: 'adult', familyMembers: []}),
      ).rejects.toThrow('household signature');
      await sign(uid, waiver.id);
      expect(await run(getMemberWaiverContext(uid))).toMatchObject({hasPendingRequired: false});
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

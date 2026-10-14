import {Effect, Either} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {waiverSignatures} from '@/src/db/schema/tables';
import {DatabaseService} from '@/src/lib/effect/database.service';
import type {WaiverSignatureInput} from '@/src/lib/waivers/schemas';

import {createTestDatabaseService} from '../layers/test-layers';

const database = vi.hoisted(() => ({select: vi.fn(), insert: vi.fn(), update: vi.fn()}));
const selectResult = vi.fn();
vi.mock('@/src/db/client', () => ({db: database}));

import {getWaiverRecord, signWaiver} from '@/src/lib/waivers/service';

const template = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Club waiver',
  version: 2,
  content: 'The approved waiver text.',
  acknowledgment: 'I have read this waiver.',
  status: 'published',
  isActive: true,
  effectiveFrom: null,
  expiresAt: null,
};
const user = {id: 'member-db-id', name: 'Alex Rider'};
const signedAt = new Date('2026-09-12T15:00:00Z');
const signatureId = '00000000-0000-4000-8000-000000000002';
const input: WaiverSignatureInput = {
  signerRole: 'household',
  signerName: 'Alex Rider',
  signerBirthDate: '1985-01-01',
  familyMembers: [{name: 'Sam Rider', birthDate: '2015-07-10'}],
  phone: '555-555-0100',
  addressStreet: '1 Main St',
  addressCity: 'Jacksonville',
  addressState: 'NC',
  addressZip: '28540',
  signatureText: 'Alex Rider',
  consent: true,
};
const evidence = {ipAddress: null, userAgent: 'test browser'};
let saved: Array<typeof waiverSignatures.$inferInsert>;

function query(rows: unknown[]) {
  const result = Object.assign(Promise.resolve(rows), {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    innerJoin: vi.fn(),
  });
  result.from.mockReturnValue(result);
  result.where.mockReturnValue(result);
  result.orderBy.mockReturnValue(result);
  result.limit.mockReturnValue(result);
  result.innerJoin.mockReturnValue(result);
  return result;
}

function context(existing?: {
  id: string;
  documentDigest: string;
  revision: number;
  signedAt: Date;
}) {
  selectResult
    .mockReturnValueOnce(query([user]))
    .mockReturnValueOnce(query([template]))
    .mockReturnValueOnce(query(existing ? [existing] : []));
}

function insertResult(rows: Array<{id: string; signedAt: Date}>) {
  database.insert.mockReturnValue({
    values: (record: typeof waiverSignatures.$inferInsert) => {
      saved.push(record);
      return {onConflictDoNothing: () => ({returning: () => Promise.resolve(rows)})};
    },
  });
}

function sign(signature: WaiverSignatureInput = input) {
  return Effect.runPromise(
    signWaiver('member-uid', 'alex@example.test', template.id, signature, evidence).pipe(
      Effect.provideService(DatabaseService, createTestDatabaseService()),
    ),
  );
}

beforeEach(() => {
  vi.stubEnv('WAIVER_SIGNATURE_SECRET', 'synthetic-test-key-not-for-production-12345');
  vi.resetAllMocks();
  database.select.mockImplementation((fields) =>
    fields && Object.keys(fields).length === 1 && 'id' in fields ? query([]) : selectResult(fields),
  );
  saved = [];
  insertResult([{id: signatureId, signedAt}]);
  database.update.mockReturnValue({set: () => ({where: () => Promise.resolve()})});
});
afterEach(() => vi.unstubAllEnvs());

describe('household waiver signing', () => {
  it.each(['', 'short', 'replace-with-an-independent-random-secret-at-least-32-characters'])(
    'rejects missing, weak, or placeholder signing secrets: %s',
    async (secret) => {
      vi.stubEnv('WAIVER_SIGNATURE_SECRET', secret);
      await expect(sign()).rejects.toThrow('configure WAIVER_SIGNATURE_SECRET');
      expect(database.select).not.toHaveBeenCalled();
      expect(database.insert).not.toHaveBeenCalled();
    },
  );
  it('stores one signature with the complete roster and the exact signed terms', async () => {
    context();
    expect(await sign()).toEqual({
      id: signatureId,
      signedAt: signedAt.toISOString(),
      alreadySigned: false,
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      revision: 1,
      signerRole: 'household',
      signerName: 'Alex Rider',
      signatureText: 'Alex Rider',
      guardianName: null,
      participants: [
        {name: 'Alex Rider', birthDate: '1985-01-01'},
        {name: 'Sam Rider', birthDate: '2015-07-10'},
      ],
      termsSnapshot: template.content,
      acknowledgmentSnapshot: template.acknowledgment,
    });
    expect(saved[0]?.consentText).toContain('every family member listed above');
    expect(saved[0]?.documentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the existing record after an identical retry without adding a signature', async () => {
    context();
    await sign();
    const original = saved[0];
    if (!original) throw new Error('Expected the initial signature');
    context({id: signatureId, signedAt, revision: 1, documentDigest: original.documentDigest});

    expect(await sign()).toMatchObject({id: signatureId, alreadySigned: true});
    expect(database.insert).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
  });

  it('requires another signature for roster changes and retains the original roster', async () => {
    context();
    await sign();
    const original = saved[0];
    if (!original) throw new Error('Expected the initial signature');
    context({id: signatureId, signedAt, revision: 1, documentDigest: original.documentDigest});
    insertResult([{id: 'new-copy-id', signedAt}]);

    const result = await sign({
      ...input,
      previousSignatureId: signatureId,
      familyMembers: [...input.familyMembers, {name: 'Pat Rider', birthDate: '1986-05-08'}],
    });

    expect(result).toMatchObject({id: 'new-copy-id', alreadySigned: false});
    expect(saved[1]?.revision).toBe(2);
    expect(saved[1]?.participants).toHaveLength(3);
    expect(original.participants).toHaveLength(2);
    expect(saved[1]?.documentDigest).not.toBe(original.documentDigest);
    // Only the member's contact profile is updated; a signed record is never overwritten.
    expect(database.update.mock.calls.every(([table]) => table !== waiverSignatures)).toBe(true);
  });

  it('rejects changed data from a stale tab before inserting another record', async () => {
    context({id: signatureId, signedAt, revision: 2, documentDigest: 'a different digest'});
    await expect(
      sign({...input, previousSignatureId: '00000000-0000-4000-8000-000000000003'}),
    ).rejects.toThrow('updated in another tab');
    expect(database.insert).not.toHaveBeenCalled();
  });

  it('deduplicates an identical concurrent insert after the unique revision wins elsewhere', async () => {
    context();
    await sign();
    const original = saved[0];
    if (!original) throw new Error('Expected the initial signature');
    context();
    insertResult([]);
    selectResult.mockReturnValueOnce(
      query([{id: signatureId, signedAt, documentDigest: original.documentDigest}]),
    );

    expect(await sign()).toMatchObject({id: signatureId, alreadySigned: true});
    expect(saved[1]?.revision).toBe(1);
  });

  it('does not accept a conflicting concurrent roster as this member’s signature', async () => {
    context();
    insertResult([]);
    selectResult.mockReturnValueOnce(
      query([{id: signatureId, signedAt, documentDigest: 'a different roster'}]),
    );

    await expect(sign()).rejects.toThrow('updated in another tab');
    expect(database.update).not.toHaveBeenCalled();
  });

  it('rejects an underage household signer before accessing the database', async () => {
    await expect(sign({...input, signerBirthDate: '2020-01-01'})).rejects.toThrow('18 or older');
    expect(database.select).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
  });

  it('rejects a retired template without saving a signature', async () => {
    selectResult
      .mockReturnValueOnce(query([user]))
      .mockReturnValueOnce(query([{...template, status: 'retired', isActive: false}]));
    await expect(sign()).rejects.toThrow('no longer available');
    expect(database.insert).not.toHaveBeenCalled();
  });
});

describe('signed household record access', () => {
  it('hides a family record from another member', async () => {
    selectResult.mockReturnValueOnce(query([{signature: {signedAt}, ownerUid: 'owner-uid'}]));
    const result = await Effect.runPromise(
      Effect.either(getWaiverRecord(signatureId, 'another-uid', false)),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe('NotFoundError');
  });

  it.each([
    ['owner-uid', false],
    ['staff-uid', true],
  ])('allows the owner or authorized staff to retrieve the snapshot', async (uid, canViewAll) => {
    selectResult.mockReturnValueOnce(
      query([{signature: {signedAt, participants: input.familyMembers}, ownerUid: 'owner-uid'}]),
    );
    const result = await Effect.runPromise(getWaiverRecord(signatureId, uid, canViewAll));
    expect(result.participants).toEqual(input.familyMembers);
    expect(result.signedAt).toBe(signedAt.toISOString());
  });
});

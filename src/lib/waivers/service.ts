import {createHash, createHmac} from 'node:crypto';

import {
  and,
  desc,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from 'drizzle-orm';
import {alias} from 'drizzle-orm/pg-core';
import {Effect} from 'effect';

import {db} from '@/src/db/client';
import {users, waiverSignatures, waiverTemplates} from '@/src/db/schema/tables';
import {DatabaseService} from '@/src/lib/effect/database.service';
import {EmailService} from '@/src/lib/effect/email.service';
import {DatabaseError, NotFoundError, ValidationError} from '@/src/lib/effect/errors';
import {getPlanTypeForPriceId} from '@/src/lib/membership-plans-config';
import {getSiteUrl} from '@/src/lib/site-url';

import {waiverSignatureSecret} from './config';
import {waiverSigningPath} from './navigation';
import {isWaiverComplete} from './policy';
import type {WaiverSignatureInput, WaiverTemplateInput} from './schemas';
import {validateWaiverSignature, waiverConsent, waiverParticipants} from './signature';

export interface WaiverRequestEvidence {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

function databaseEffect<A>(operation: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new DatabaseError({
        code: `WAIVER_${operation.toUpperCase()}_FAILED`,
        message: `Failed to ${operation.replaceAll('_', ' ')} waiver data`,
        cause,
      }),
  });
}

function activeTemplateFilter(now: Date) {
  const newer = alias(waiverTemplates, 'newer_waiver');
  return and(
    eq(waiverTemplates.status, 'published'),
    or(isNull(waiverTemplates.effectiveFrom), lte(waiverTemplates.effectiveFrom, now)),
    or(isNull(waiverTemplates.expiresAt), gt(waiverTemplates.expiresAt, now)),
    notExists(
      db
        .select({id: newer.id})
        .from(newer)
        .where(
          and(
            eq(newer.title, waiverTemplates.title),
            eq(newer.scope, waiverTemplates.scope),
            eq(newer.status, 'published'),
            gt(newer.version, waiverTemplates.version),
            or(isNull(newer.effectiveFrom), lte(newer.effectiveFrom, now)),
          ),
        ),
    ),
  );
}

function normalized(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ');
}

function latestSignatures() {
  return db
    .selectDistinctOn([waiverSignatures.userId, waiverSignatures.waiverTemplateId])
    .from(waiverSignatures)
    .orderBy(
      waiverSignatures.userId,
      waiverSignatures.waiverTemplateId,
      desc(waiverSignatures.revision),
    )
    .as('latest_signature');
}

function parseOptionalDate(value: string | undefined, field: string) {
  if (!value) return Effect.succeed<Date | null>(null);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Effect.fail(
      new ValidationError({
        field,
        message: `${field} must be a valid date`,
      }),
    );
  }
  return Effect.succeed(date);
}

export const listMemberWaivers = Effect.fn('Waivers.listMemberWaivers')(function* (
  firebaseUid: string,
) {
  const now = new Date();
  return yield* databaseEffect('list_member', async () => {
    const latest = latestSignatures();
    const user = await db
      .select({id: users.id})
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) return [];

    const rows = await db
      .select({
        id: waiverTemplates.id,
        title: waiverTemplates.title,
        description: waiverTemplates.description,
        scope: waiverTemplates.scope,
        version: waiverTemplates.version,
        content: waiverTemplates.content,
        acknowledgment: waiverTemplates.acknowledgment,
        isRequired: waiverTemplates.isRequired,
        isActive: sql<boolean>`${activeTemplateFilter(now)}`,
        effectiveFrom: waiverTemplates.effectiveFrom,
        expiresAt: waiverTemplates.expiresAt,
        signatureId: latest.id,
        signedAt: latest.signedAt,
        signerName: latest.signerName,
        signerRole: latest.signerRole,
        participants: latest.participants,
        revision: latest.revision,
        phone: latest.phone,
        addressStreet: latest.addressStreet,
        addressCity: latest.addressCity,
        addressState: latest.addressState,
        addressZip: latest.addressZip,
      })
      .from(waiverTemplates)
      .leftJoin(
        latest,
        and(eq(latest.waiverTemplateId, waiverTemplates.id), eq(latest.userId, user.id)),
      )
      .where(or(activeTemplateFilter(now), isNotNull(latest.id)))
      .orderBy(desc(waiverTemplates.isRequired), waiverTemplates.title);

    const history = await db
      .select({
        id: waiverSignatures.id,
        templateId: waiverSignatures.waiverTemplateId,
        revision: waiverSignatures.revision,
        signedAt: waiverSignatures.signedAt,
      })
      .from(waiverSignatures)
      .where(eq(waiverSignatures.userId, user.id))
      .orderBy(desc(waiverSignatures.signedAt));

    return rows.map((row) => ({
      ...row,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      signedAt: row.signedAt?.toISOString() ?? null,
      isSigned: row.signatureId !== null,
      history: history
        .filter((record) => record.templateId === row.id)
        .map((record) => ({...record, signedAt: record.signedAt.toISOString()})),
    }));
  });
});

export const getRequiredMembershipWaivers = Effect.fn('Waivers.getRequiredMembershipWaivers')(
  function* () {
    yield* waiverSignatureSecret();
    const now = new Date();
    return yield* databaseEffect('get_required', () =>
      db
        .select({
          id: waiverTemplates.id,
          title: waiverTemplates.title,
          version: waiverTemplates.version,
          content: waiverTemplates.content,
          acknowledgment: waiverTemplates.acknowledgment,
        })
        .from(waiverTemplates)
        .where(
          and(
            activeTemplateFilter(now),
            eq(waiverTemplates.scope, 'membership'),
            eq(waiverTemplates.isRequired, true),
          ),
        )
        .orderBy(waiverTemplates.title, desc(waiverTemplates.version)),
    );
  },
);

export const getMemberWaiverContext = Effect.fn('Waivers.getMemberContext')(function* (
  firebaseUid: string,
) {
  const database = yield* DatabaseService;
  const membership = yield* database.getActiveMembership(firebaseUid);
  const waivers = yield* listMemberWaivers(firebaseUid);
  const requireHousehold = membership?.planType === 'family';
  return {
    userId: firebaseUid,
    requireHousehold,
    needsMembership: !membership || membership.status === 'expired',
    waivers,
    hasPendingRequired: waivers.some(
      (waiver) =>
        waiver.isActive && waiver.isRequired && !isWaiverComplete(waiver, requireHousehold),
    ),
  };
});

export const hasSignedRequiredMembershipWaiver = Effect.fn(
  'Waivers.hasSignedRequiredMembershipWaiver',
)(function* (firebaseUid: string, requireHousehold = false) {
  const now = new Date();
  return yield* databaseEffect('check_required_signature', async () => {
    const latest = latestSignatures();
    const user = await db
      .select({id: users.id})
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1)
      .then((rows) => rows[0]);
    if (!user) return false;

    const required = await db
      .select({id: waiverTemplates.id, signatureId: latest.id, signerRole: latest.signerRole})
      .from(waiverTemplates)
      .leftJoin(
        latest,
        and(eq(latest.waiverTemplateId, waiverTemplates.id), eq(latest.userId, user.id)),
      )
      .where(
        and(
          activeTemplateFilter(now),
          eq(waiverTemplates.scope, 'membership'),
          eq(waiverTemplates.isRequired, true),
        ),
      );

    return (
      required.length > 0 &&
      required.every((item) =>
        isWaiverComplete(
          {isSigned: item.signatureId !== null, signerRole: item.signerRole},
          requireHousehold,
        ),
      )
    );
  });
});

export const requireCheckoutWaivers = Effect.fn('Waivers.requireCheckoutWaivers')(function* (
  firebaseUid: string | undefined,
  priceId: string,
) {
  const requireHousehold = getPlanTypeForPriceId(priceId) === 'family';
  if (!firebaseUid || !(yield* hasSignedRequiredMembershipWaiver(firebaseUid, requireHousehold))) {
    return yield* new ValidationError({
      field: 'waiver',
      message: requireHousehold
        ? 'Complete your household waiver before checkout.'
        : 'Sign the required liability waivers before checkout.',
      actionUrl: waiverSigningPath({household: requireHousehold, returnTo: '/renew'}),
    });
  }
});

export const signWaiver = Effect.fn('Waivers.signWaiver')(function* (
  firebaseUid: string,
  signerEmail: string,
  templateId: string,
  input: WaiverSignatureInput,
  evidence: WaiverRequestEvidence,
) {
  const signerName = normalized(input.signerName);
  const signatureText = normalized(input.signatureText);
  const signedAt = new Date();
  const validation = validateWaiverSignature(input, signedAt);
  if (validation) return yield* new ValidationError({field: 'signature', message: validation});
  const secret = yield* waiverSignatureSecret();
  const database = yield* DatabaseService;
  const membership = yield* database.getActiveMembership(firebaseUid);
  if (membership?.planType === 'family' && input.signerRole !== 'household') {
    return yield* new ValidationError({
      field: 'signerRole',
      message: 'Your family membership requires a household signature.',
    });
  }
  const participants = waiverParticipants(input);
  const consentText = waiverConsent(input.signerRole);
  const [user, template] = yield* databaseEffect('load_signing_context', () =>
    Promise.all([
      db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({
          ...getTableColumns(waiverTemplates),
          isActive: sql<boolean>`${activeTemplateFilter(signedAt)}`,
        })
        .from(waiverTemplates)
        .where(eq(waiverTemplates.id, templateId))
        .limit(1)
        .then((rows) => rows[0]),
    ]),
  );

  if (!user) return yield* new NotFoundError({resource: 'Member', id: firebaseUid});
  if (!template || !template.isActive) {
    return yield* new ValidationError({
      field: 'templateId',
      message:
        'This waiver has changed or is no longer available. Refresh the page to sign the current version.',
    });
  }

  const existing = yield* databaseEffect('latest_signature', () =>
    db
      .select({
        id: waiverSignatures.id,
        signedAt: waiverSignatures.signedAt,
        revision: waiverSignatures.revision,
        documentDigest: waiverSignatures.documentDigest,
      })
      .from(waiverSignatures)
      .where(
        and(
          eq(waiverSignatures.userId, user.id),
          eq(waiverSignatures.waiverTemplateId, template.id),
        ),
      )
      .orderBy(desc(waiverSignatures.revision))
      .limit(1)
      .then((rows) => rows[0]),
  );

  const signatureValues = {
    signerRole: input.signerRole,
    participants,
    signerName,
    signerEmail,
    signatureText,
    consentText,
    phone: normalized(input.phone),
    addressStreet: normalized(input.addressStreet),
    addressCity: normalized(input.addressCity),
    addressState: normalized(input.addressState),
    addressZip: normalized(input.addressZip),
  };
  // Excluding server time makes identical retries idempotent. The roster and all
  // signed content are included, so any change requires a new immutable revision.
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        format: 2,
        templateId: template.id,
        templateVersion: template.version,
        terms: template.content,
        acknowledgment: template.acknowledgment,
        userId: user.id,
        ...signatureValues,
      }),
    )
    .digest('hex');
  if (existing?.documentDigest === digest) {
    return {id: existing.id, signedAt: existing.signedAt.toISOString(), alreadySigned: true};
  }
  if ((existing?.id ?? undefined) !== input.previousSignatureId) {
    return yield* new ValidationError({
      field: 'previousSignatureId',
      message:
        'A signed copy already exists or was updated in another tab. Refresh the page, then choose Update family details to sign a new copy.',
    });
  }
  const revision = (existing?.revision ?? 0) + 1;

  const inserted = yield* databaseEffect('save_signature', () =>
    db
      .insert(waiverSignatures)
      .values({
        waiverTemplateId: template.id,
        userId: user.id,
        ...signatureValues,
        revision,
        participantName: signerName,
        participantBirthDate: input.signerBirthDate,
        guardianName: null,
        templateTitle: template.title,
        templateVersion: template.version,
        termsSnapshot: template.content,
        acknowledgmentSnapshot: template.acknowledgment,
        participantSignatureText: signatureText,
        documentDigest: digest,
        ipAddressHash: evidence.ipAddress
          ? createHmac('sha256', secret).update(evidence.ipAddress).digest('hex')
          : null,
        userAgent: evidence.userAgent,
        signedAt,
      })
      .onConflictDoNothing()
      .returning({id: waiverSignatures.id, signedAt: waiverSignatures.signedAt})
      .then((rows) => rows[0]),
  );

  if (!inserted) {
    const concurrent = yield* databaseEffect('concurrent_signature', () =>
      db
        .select({
          id: waiverSignatures.id,
          signedAt: waiverSignatures.signedAt,
          documentDigest: waiverSignatures.documentDigest,
        })
        .from(waiverSignatures)
        .where(
          and(
            eq(waiverSignatures.userId, user.id),
            eq(waiverSignatures.waiverTemplateId, template.id),
            eq(waiverSignatures.revision, revision),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]),
    );
    if (!concurrent || concurrent.documentDigest !== digest)
      return yield* new ValidationError({
        field: 'previousSignatureId',
        message: 'Your waiver was updated in another tab. Refresh before making another change.',
      });
    return {id: concurrent.id, signedAt: concurrent.signedAt.toISOString(), alreadySigned: true};
  }

  yield* databaseEffect('update_contact', () =>
    db
      .update(users)
      .set({
        name: user.name ?? signerName,
        phone: normalized(input.phone),
        addressStreet: normalized(input.addressStreet),
        addressCity: normalized(input.addressCity),
        addressState: normalized(input.addressState),
        addressZip: normalized(input.addressZip),
        updatedAt: signedAt,
      })
      .where(eq(users.id, user.id)),
  );

  return {id: inserted.id, signedAt: inserted.signedAt.toISOString(), alreadySigned: false};
});

export const listWaiverTemplates = Effect.fn('Waivers.listTemplates')(function* () {
  return yield* databaseEffect('list_templates', async () => {
    const templates = await db
      .select({
        id: waiverTemplates.id,
        title: waiverTemplates.title,
        description: waiverTemplates.description,
        scope: waiverTemplates.scope,
        status: waiverTemplates.status,
        version: waiverTemplates.version,
        isRequired: waiverTemplates.isRequired,
        effectiveFrom: waiverTemplates.effectiveFrom,
        expiresAt: waiverTemplates.expiresAt,
        createdAt: waiverTemplates.createdAt,
        signatureCount: sql<number>`count(distinct ${waiverSignatures.userId})::int`,
        canInvite: sql<boolean>`${activeTemplateFilter(new Date())}`,
      })
      .from(waiverTemplates)
      .leftJoin(waiverSignatures, eq(waiverSignatures.waiverTemplateId, waiverTemplates.id))
      .groupBy(waiverTemplates.id)
      .orderBy(desc(waiverTemplates.createdAt));

    return templates.map((template) => ({
      ...template,
      effectiveFrom: template.effectiveFrom?.toISOString() ?? null,
      expiresAt: template.expiresAt?.toISOString() ?? null,
      createdAt: template.createdAt.toISOString(),
    }));
  });
});

export const createWaiverTemplate = Effect.fn('Waivers.createTemplate')(function* (
  input: WaiverTemplateInput,
  createdBy: string,
) {
  const effectiveFrom = yield* parseOptionalDate(input.effectiveFrom, 'effectiveFrom');
  const expiresAt = yield* parseOptionalDate(input.expiresAt, 'expiresAt');
  if (effectiveFrom && expiresAt && expiresAt <= effectiveFrom) {
    return yield* Effect.fail(
      new ValidationError({
        field: 'expiresAt',
        message: 'Expiration must be after the effective date',
      }),
    );
  }

  return yield* databaseEffect('create_template', async () => {
    const nextVersion = await db
      .select({value: sql<number>`coalesce(max(${waiverTemplates.version}), 0)::int + 1`})
      .from(waiverTemplates)
      .where(eq(waiverTemplates.title, normalized(input.title)))
      .then((rows) => rows[0]?.value ?? 1);

    const created = await db
      .insert(waiverTemplates)
      .values({
        title: normalized(input.title),
        description: input.description?.trim() || null,
        scope: input.scope,
        version: nextVersion,
        content: input.content.trim(),
        acknowledgment: input.acknowledgment.trim(),
        isRequired: input.isRequired,
        effectiveFrom,
        expiresAt,
        createdBy,
      })
      .returning()
      .then((rows) => rows[0]);

    if (!created) throw new Error('Waiver template was not created');
    return {id: created.id, version: created.version, status: created.status};
  });
});

export const updateWaiverTemplateStatus = Effect.fn('Waivers.updateTemplateStatus')(function* (
  templateId: string,
  action: 'publish' | 'retire',
) {
  const template = yield* databaseEffect('find_template', () =>
    db
      .select()
      .from(waiverTemplates)
      .where(eq(waiverTemplates.id, templateId))
      .limit(1)
      .then((rows) => rows[0]),
  );
  if (!template) {
    return yield* Effect.fail(new NotFoundError({resource: 'Waiver template', id: templateId}));
  }
  if (action === 'publish' && template.status !== 'draft') {
    return yield* Effect.fail(
      new ValidationError({field: 'action', message: 'Only draft waivers can be published'}),
    );
  }
  if (action === 'retire' && template.status !== 'published') {
    return yield* Effect.fail(
      new ValidationError({field: 'action', message: 'Only published waivers can be retired'}),
    );
  }

  const status = action === 'publish' ? 'published' : 'retired';
  const now = new Date();
  const effectiveFrom = template.effectiveFrom ?? now;
  if (action === 'publish' && template.expiresAt && template.expiresAt <= now) {
    return yield* new ValidationError({
      field: 'expiresAt',
      message: 'An expired waiver cannot be published',
    });
  }
  return yield* databaseEffect('update_template', async () => {
    if (action === 'publish') {
      // One atomic update. activeTemplateFilter selects the newest effective
      // version without rewriting the predecessor's dates or signed history.
      await db
        .update(waiverTemplates)
        .set({status, effectiveFrom, updatedAt: now})
        .where(and(eq(waiverTemplates.id, templateId), eq(waiverTemplates.status, 'draft')));
    } else if (effectiveFrom > now) {
      // Canceling a scheduled version must leave its predecessor available.
      await db
        .update(waiverTemplates)
        .set({status, updatedAt: now})
        .where(eq(waiverTemplates.id, templateId));
    } else {
      // Retiring an effective version must not resurrect its superseded versions.
      await db
        .update(waiverTemplates)
        .set({status, updatedAt: now})
        .where(
          and(
            eq(waiverTemplates.title, template.title),
            eq(waiverTemplates.scope, template.scope),
            eq(waiverTemplates.status, 'published'),
            lte(waiverTemplates.version, template.version),
            or(isNull(waiverTemplates.effectiveFrom), lte(waiverTemplates.effectiveFrom, now)),
          ),
        );
    }
    return {id: templateId, status};
  });
});

export const getWaiverCompletion = Effect.fn('Waivers.getCompletion')(function* (
  requestedTemplateId?: string,
) {
  const templates = yield* listWaiverTemplates();
  const selected =
    templates.find((template) => template.id === requestedTemplateId) ??
    templates.find(
      (template) => template.canInvite && template.scope === 'membership' && template.isRequired,
    ) ??
    templates[0];

  if (!selected) return {templates, selectedTemplateId: null, members: [], signed: 0, pending: 0};

  const database = yield* DatabaseService;
  const currentMembers = yield* database.getCurrentMemberContacts();
  const records = yield* databaseEffect('completion', () =>
    db
      .select({
        userId: users.firebaseUid,
        name: users.name,
        email: users.email,
        signatureId: waiverSignatures.id,
        signerName: waiverSignatures.signerName,
        signerRole: waiverSignatures.signerRole,
        participants: waiverSignatures.participants,
        signedAt: waiverSignatures.signedAt,
        revision: waiverSignatures.revision,
      })
      .from(waiverSignatures)
      .innerJoin(users, eq(users.id, waiverSignatures.userId))
      .where(eq(waiverSignatures.waiverTemplateId, selected.id))
      .orderBy(desc(waiverSignatures.revision)),
  );

  const recordsByUser = new Map<string, typeof records>();
  for (const record of records) {
    const history = recordsByUser.get(record.userId) ?? [];
    history.push(record);
    recordsByUser.set(record.userId, history);
  }
  const audience = new Map(currentMembers.map((member) => [member.userId, member]));
  // Include former members in record browsing, but never in the invitation audience.
  const identities = new Map(
    records.map((record) => [
      record.userId,
      {
        userId: record.userId,
        name: record.name,
        email: record.email,
      },
    ]),
  );
  for (const member of currentMembers) identities.set(member.userId, member);
  const members = [...identities.values()].map((member) => {
    const history = recordsByUser.get(member.userId) ?? [];
    const latest = history[0];
    const current = audience.get(member.userId);
    return {
      ...member,
      isCurrent: !!current,
      signatureId: latest?.signatureId ?? null,
      signerName: latest?.signerName ?? null,
      signerRole: latest?.signerRole ?? null,
      participants: latest?.participants ?? null,
      signedAt: latest?.signedAt.toISOString() ?? null,
      isSigned: isWaiverComplete(
        {isSigned: !!latest, signerRole: latest?.signerRole ?? null},
        current?.planType === 'family',
      ),
      history: history.map((record) => ({
        id: record.signatureId,
        revision: record.revision,
        signedAt: record.signedAt.toISOString(),
      })),
    };
  });

  const signed = members.filter((member) => member.isCurrent && member.isSigned).length;
  return {
    templates,
    selectedTemplateId: selected.id,
    members,
    signed,
    pending: currentMembers.length - signed,
  };
});

export const getWaiverRecord = Effect.fn('Waivers.getRecord')(function* (
  signatureId: string,
  requesterUid: string,
  canViewAll: boolean,
) {
  const record = yield* databaseEffect('get_record', () =>
    db
      .select({
        signature: waiverSignatures,
        ownerUid: users.firebaseUid,
      })
      .from(waiverSignatures)
      .innerJoin(users, eq(users.id, waiverSignatures.userId))
      .where(eq(waiverSignatures.id, signatureId))
      .limit(1)
      .then((rows) => rows[0]),
  );

  if (!record || (!canViewAll && record.ownerUid !== requesterUid)) {
    return yield* Effect.fail(new NotFoundError({resource: 'Signed waiver', id: signatureId}));
  }

  return {
    ...record.signature,
    signedAt: record.signature.signedAt.toISOString(),
  };
});

export const sendUnsignedWaiverEmails = Effect.fn('Waivers.sendUnsignedEmails')(function* (
  templateId: string,
  sentBy: string,
  sentByEmail?: string,
) {
  yield* waiverSignatureSecret();
  const completion = yield* getWaiverCompletion(templateId);
  const template = completion.templates.find((item) => item.id === templateId);
  if (!template) {
    return yield* Effect.fail(new NotFoundError({resource: 'Waiver template', id: templateId}));
  }
  if (!template.canInvite) {
    return yield* new ValidationError({
      field: 'templateId',
      message: 'Invitations require a published waiver that is currently available to sign.',
    });
  }

  const database = yield* DatabaseService;
  const email = yield* EmailService;
  yield* email.ensureWaiverEmailConfigured();
  const campaignKey = `waiver/${templateId}`;
  const emailType = 'liability_waiver_signature_request';
  const subject = 'Action required: sign your Down East Cyclists liability waiver';
  const signUrl = `${getSiteUrl()}${waiverSigningPath({templateId})}`;
  const initial = {sent: 0, skipped: 0, failed: 0};

  return yield* Effect.reduce(completion.members, initial, (result, member) =>
    Effect.gen(function* () {
      if (!member.isCurrent || member.isSigned) return {...result, skipped: result.skipped + 1};

      const existing = yield* database.getLatestEmailLog(member.userId, emailType, campaignKey);
      if (existing?.status === 'sent') return {...result, skipped: result.skipped + 1};

      const idempotencyKey = `waiver-request/${templateId}/${member.userId}`;
      const outcome = yield* email
        .sendWaiverSignatureRequestEmail({
          to: member.email,
          name: member.name ?? undefined,
          waiverTitle: template.title,
          signUrl,
          idempotencyKey,
        })
        .pipe(Effect.either);

      yield* database.logEmailEvent(member.userId, {
        emailType,
        deliveryType: 'one-time',
        campaignKey,
        recipientEmail: member.email,
        subject,
        status: outcome._tag === 'Right' ? 'sent' : 'failed',
        idempotencyKey,
        sentBy,
        sentByEmail,
        errorMessage: outcome._tag === 'Left' ? outcome.left.message : undefined,
      });

      return outcome._tag === 'Right'
        ? {...result, sent: result.sent + 1}
        : {...result, failed: result.failed + 1};
    }),
  );
});

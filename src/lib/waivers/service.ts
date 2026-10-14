import {createHash, createHmac} from 'node:crypto';

import {and, desc, eq, gt, gte, inArray, isNull, lte, or, sql} from 'drizzle-orm';
import {Effect} from 'effect';

import {db} from '@/src/db/client';
import {memberships, users, waiverSignatures, waiverTemplates} from '@/src/db/schema/tables';
import {DatabaseService} from '@/src/lib/effect/database.service';
import {EmailService} from '@/src/lib/effect/email.service';
import {DatabaseError, NotFoundError, ValidationError} from '@/src/lib/effect/errors';
import {getSiteUrl} from '@/src/lib/site-url';

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
  return and(
    eq(waiverTemplates.status, 'published'),
    or(isNull(waiverTemplates.effectiveFrom), lte(waiverTemplates.effectiveFrom, now)),
    or(isNull(waiverTemplates.expiresAt), gt(waiverTemplates.expiresAt, now)),
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

function hashIpAddress(ipAddress: string | null): string | null {
  const secret = process.env.WAIVER_SIGNATURE_SECRET;
  if (!ipAddress || !secret) return null;
  return createHmac('sha256', secret).update(ipAddress).digest('hex');
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
      .where(activeTemplateFilter(now))
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
      .orderBy(desc(waiverSignatures.signedAt))
      .limit(100);

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

export const getRequiredMembershipWaiver = Effect.fn('Waivers.getRequiredMembershipWaiver')(
  function* () {
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
        .orderBy(desc(waiverTemplates.version))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    );
  },
);

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
      required.every(
        (item) =>
          item.signatureId !== null && (!requireHousehold || item.signerRole === 'household'),
      )
    );
  });
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
        .select()
        .from(waiverTemplates)
        .where(eq(waiverTemplates.id, templateId))
        .limit(1)
        .then((rows) => rows[0]),
    ]),
  );

  if (!user) return yield* new NotFoundError({resource: 'Member', id: firebaseUid});
  if (
    !template ||
    template.status !== 'published' ||
    (template.effectiveFrom && template.effectiveFrom > signedAt) ||
    (template.expiresAt && template.expiresAt <= signedAt)
  ) {
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
        ipAddressHash: hashIpAddress(evidence.ipAddress),
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
  return yield* databaseEffect('update_template', async () => {
    if (action === 'publish') {
      await db
        .update(waiverTemplates)
        .set({status: 'retired', updatedAt: new Date()})
        .where(
          and(
            eq(waiverTemplates.title, template.title),
            eq(waiverTemplates.scope, template.scope),
            eq(waiverTemplates.status, 'published'),
          ),
        );
    }
    await db
      .update(waiverTemplates)
      .set({
        status,
        effectiveFrom:
          action === 'publish' ? (template.effectiveFrom ?? new Date()) : template.effectiveFrom,
        updatedAt: new Date(),
      })
      .where(eq(waiverTemplates.id, templateId));
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
      (template) =>
        template.status === 'published' && template.scope === 'membership' && template.isRequired,
    ) ??
    templates[0];

  if (!selected) return {templates, selectedTemplateId: null, members: [], signed: 0, pending: 0};

  const currentStatuses: Array<'active' | 'trialing' | 'complimentary' | 'legacy'> = [
    'active',
    'trialing',
    'complimentary',
    'legacy',
  ];
  const now = new Date();
  const members = yield* databaseEffect('completion', async () => {
    const latest = latestSignatures();
    const rows = await db
      .selectDistinctOn([users.id], {
        userId: users.firebaseUid,
        name: users.name,
        email: users.email,
        planType: memberships.planType,
        signatureId: latest.id,
        signerName: latest.signerName,
        signerRole: latest.signerRole,
        participants: latest.participants,
        signedAt: latest.signedAt,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .leftJoin(latest, and(eq(latest.userId, users.id), eq(latest.waiverTemplateId, selected.id)))
      .where(and(inArray(memberships.status, currentStatuses), gte(memberships.endDate, now)))
      .orderBy(users.id, desc(memberships.endDate));

    return rows.map((member) => ({
      ...member,
      signedAt: member.signedAt?.toISOString() ?? null,
      isSigned:
        member.signatureId !== null &&
        (member.planType !== 'family' || member.signerRole === 'household'),
    }));
  });

  const signed = members.filter((member) => member.isSigned).length;
  return {
    templates,
    selectedTemplateId: selected.id,
    members,
    signed,
    pending: members.length - signed,
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
  const completion = yield* getWaiverCompletion(templateId);
  const template = completion.templates.find((item) => item.id === templateId);
  if (!template) {
    return yield* Effect.fail(new NotFoundError({resource: 'Waiver template', id: templateId}));
  }

  const database = yield* DatabaseService;
  const email = yield* EmailService;
  const campaignKey = `waiver/${templateId}`;
  const emailType = 'liability_waiver_signature_request';
  const subject = 'Action required: sign your Down East Cyclists liability waiver';
  const signUrl = `${getSiteUrl()}/login`;
  const initial = {sent: 0, skipped: 0, failed: 0};

  return yield* Effect.reduce(completion.members, initial, (result, member) =>
    Effect.gen(function* () {
      if (member.isSigned) return {...result, skipped: result.skipped + 1};

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

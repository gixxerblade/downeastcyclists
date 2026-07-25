import {createHash, randomUUID} from 'node:crypto';

import {and, asc, count, desc, eq, sql} from 'drizzle-orm';

import {db} from '@/src/db/client';
import {
  trailMaintenanceEvents,
  trailMaintenanceNotes,
  trailMaintenancePhotos,
  trailMaintenanceReports,
  trailSegments,
  trailSystems,
  users,
} from '@/src/db/schema/tables';

import {
  trailIssuePriorityLabels,
  trailIssueStatusLabels,
  trailIssueTypeLabels,
  type TrailIssuePriority,
  type TrailIssueStatus,
} from './constants';
import {getTrailPhotoSignedUrl, type StoredTrailPhoto} from './r2';
import type {
  PublicTrailMaintenanceReportInput,
  TrailMaintenanceListQuery,
  TrailMaintenanceUpdateInput,
} from './validation';

export interface TrailMaintenanceOption {
  readonly slug: string;
  readonly name: string;
  readonly segments: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly colorLabel: string | null;
  }>;
}

export interface TrailMaintenanceReportSummary {
  readonly id: string;
  readonly publicId: string;
  readonly issueType: string;
  readonly issueTypeLabel: string;
  readonly status: TrailIssueStatus;
  readonly statusLabel: string;
  readonly priority: TrailIssuePriority;
  readonly priorityLabel: string;
  readonly trailSystemName: string;
  readonly trailSegmentName: string | null;
  readonly observedAt: string;
  readonly createdAt: string;
  readonly photoCount: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly locationNotes: string | null;
}

export interface TrailMaintenanceReportDetail extends TrailMaintenanceReportSummary {
  readonly description: string | null;
  readonly reporterName: string | null;
  readonly reporterContact: string | null;
  readonly photos: ReadonlyArray<{
    readonly id: string;
    readonly url: string | null;
    readonly originalFilename: string | null;
    readonly contentType: string;
    readonly byteSize: number;
  }>;
  readonly notes: ReadonlyArray<{
    readonly id: string;
    readonly note: string;
    readonly authorEmail: string | null;
    readonly createdAt: string;
  }>;
  readonly events: ReadonlyArray<{
    readonly id: string;
    readonly eventType: string;
    readonly actorLabel: string;
    readonly details: Record<string, unknown> | null;
    readonly createdAt: string;
  }>;
}

export interface PublicTrailMaintenanceReportDetail {
  readonly publicId: string;
  readonly issueTypeLabel: string;
  readonly status: TrailIssueStatus;
  readonly statusLabel: string;
  readonly priority: TrailIssuePriority;
  readonly priorityLabel: string;
  readonly trailSystemName: string;
  readonly trailSegmentName: string | null;
  readonly observedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly locationNotes: string | null;
  readonly description: string | null;
  readonly photos: ReadonlyArray<{
    readonly id: string;
    readonly url: string | null;
    readonly originalFilename: string | null;
    readonly contentType: string;
    readonly byteSize: number;
  }>;
}

export interface TrailMaintenanceListResult {
  readonly reports: TrailMaintenanceReportSummary[];
  readonly total: number;
}

export interface StaffActor {
  readonly uid: string;
  readonly email?: string;
}

function makePublicId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256')
    .update(`${process.env.QR_SIGNING_SECRET ?? 'trail-maintenance'}:${ip}`)
    .digest('hex');
}

function issueTypeLabel(issueType: string, issueTypeOther: string | null): string {
  if (issueType === 'other' && issueTypeOther) return issueTypeOther;
  return trailIssueTypeLabels[issueType as keyof typeof trailIssueTypeLabels] ?? issueType;
}

function actorLabel(actor: StaffActor): string {
  return actor.email || actor.uid;
}

async function resolveStaffUser(actor: StaffActor) {
  return db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, actor.uid))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getTrailMaintenanceOptions(): Promise<TrailMaintenanceOption[]> {
  const systems = await db
    .select()
    .from(trailSystems)
    .where(eq(trailSystems.isActive, true))
    .orderBy(asc(trailSystems.sortOrder), asc(trailSystems.name));

  const segments = await db
    .select()
    .from(trailSegments)
    .where(eq(trailSegments.isActive, true))
    .orderBy(asc(trailSegments.sortOrder), asc(trailSegments.name));

  return systems.map((system) => ({
    slug: system.slug,
    name: system.name,
    segments: segments
      .filter((segment) => segment.trailSystemId === system.id)
      .map((segment) => ({
        slug: segment.slug,
        name: segment.name,
        colorLabel: segment.colorLabel,
      })),
  }));
}

export async function createTrailMaintenanceReport({
  input,
  photos,
  publicId = makePublicId(),
  userAgent,
  remoteIp,
}: {
  readonly input: PublicTrailMaintenanceReportInput;
  readonly photos: readonly StoredTrailPhoto[];
  readonly publicId?: string;
  readonly userAgent: string | null;
  readonly remoteIp: string | null;
}): Promise<{readonly id: string; readonly publicId: string}> {
  const [system] = await db
    .select()
    .from(trailSystems)
    .where(eq(trailSystems.slug, input.trailSystemSlug))
    .limit(1);
  if (!system) {
    throw new Error('Trail system not found');
  }

  const [segment] = await db
    .select()
    .from(trailSegments)
    .where(
      and(
        eq(trailSegments.trailSystemId, system.id),
        eq(trailSegments.slug, input.trailSegmentSlug),
      ),
    )
    .limit(1);
  if (!segment) {
    throw new Error('Trail not found');
  }

  const [report] = await db
    .insert(trailMaintenanceReports)
    .values({
      publicId,
      trailSystemId: system.id,
      trailSegmentId: segment.id,
      issueType: input.issueType,
      issueTypeOther: input.issueTypeOther ?? null,
      observedAt: input.observedAt,
      description: input.description ?? null,
      locationSource: input.locationSource,
      locationNotes: input.locationNotes ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locationAccuracyMeters: input.locationAccuracyMeters ?? null,
      reporterName: input.reporterName ?? null,
      reporterContact: input.reporterContact ?? null,
      userAgent,
      submitterIpHash: hashIp(remoteIp),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (photos.length > 0) {
    await db.insert(trailMaintenancePhotos).values(
      photos.map((photo) => ({
        reportId: report.id,
        bucketName: photo.bucketName,
        objectKey: photo.objectKey,
        originalFilename: photo.originalFilename,
        contentType: photo.contentType,
        byteSize: photo.byteSize,
        sortOrder: photo.sortOrder,
        createdAt: new Date(),
      })),
    );
  }

  await db.insert(trailMaintenanceEvents).values({
    reportId: report.id,
    eventType: 'created',
    actorLabel: 'Public reporter',
    details: {photoCount: photos.length},
    createdAt: new Date(),
  });

  return {id: report.id, publicId};
}

export async function getTrailMaintenanceReportRecipients(): Promise<string[]> {
  const organizerRows = await db
    .select({email: users.email})
    .from(users)
    .where(eq(users.isOrganizer, true));

  const adminEmails = [
    process.env.ADMIN_EMAIL,
    ...(process.env.ADMIN_EMAIL_WHITELIST ?? '').split(','),
  ];

  return Array.from(
    new Set(
      [...organizerRows.map((row) => row.email), ...adminEmails]
        .map((email) => email?.trim())
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

export async function listTrailMaintenanceReports(
  query: TrailMaintenanceListQuery,
): Promise<TrailMaintenanceListResult> {
  const conditions = [
    query.status ? eq(trailMaintenanceReports.status, query.status) : undefined,
    query.priority ? eq(trailMaintenanceReports.priority, query.priority) : undefined,
    query.issueType ? eq(trailMaintenanceReports.issueType, query.issueType) : undefined,
  ].filter((condition) => condition !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.pageSize;

  const totalRows = await db.select({count: count()}).from(trailMaintenanceReports).where(where);

  const rows = await db
    .select({
      report: trailMaintenanceReports,
      systemName: trailSystems.name,
      segmentName: trailSegments.name,
      photoCount: sql<number>`count(${trailMaintenancePhotos.id})::int`,
    })
    .from(trailMaintenanceReports)
    .innerJoin(trailSystems, eq(trailMaintenanceReports.trailSystemId, trailSystems.id))
    .leftJoin(trailSegments, eq(trailMaintenanceReports.trailSegmentId, trailSegments.id))
    .leftJoin(
      trailMaintenancePhotos,
      eq(trailMaintenanceReports.id, trailMaintenancePhotos.reportId),
    )
    .where(where)
    .groupBy(trailMaintenanceReports.id, trailSystems.name, trailSegments.name)
    .orderBy(desc(trailMaintenanceReports.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  return {
    total: totalRows[0]?.count ?? 0,
    reports: rows.map((row) => ({
      id: row.report.id,
      publicId: row.report.publicId,
      issueType: row.report.issueType,
      issueTypeLabel: issueTypeLabel(row.report.issueType, row.report.issueTypeOther),
      status: row.report.status,
      statusLabel: trailIssueStatusLabels[row.report.status],
      priority: row.report.priority,
      priorityLabel: trailIssuePriorityLabels[row.report.priority],
      trailSystemName: row.systemName,
      trailSegmentName: row.segmentName,
      observedAt: row.report.observedAt.toISOString(),
      createdAt: row.report.createdAt.toISOString(),
      photoCount: row.photoCount,
      latitude: row.report.latitude,
      longitude: row.report.longitude,
      locationNotes: row.report.locationNotes,
    })),
  };
}

export async function getTrailMaintenanceReportDetail(
  reportId: string,
): Promise<TrailMaintenanceReportDetail | null> {
  const [row] = await db
    .select({
      report: trailMaintenanceReports,
      systemName: trailSystems.name,
      segmentName: trailSegments.name,
      photoCount: sql<number>`count(${trailMaintenancePhotos.id})::int`,
    })
    .from(trailMaintenanceReports)
    .innerJoin(trailSystems, eq(trailMaintenanceReports.trailSystemId, trailSystems.id))
    .leftJoin(trailSegments, eq(trailMaintenanceReports.trailSegmentId, trailSegments.id))
    .leftJoin(
      trailMaintenancePhotos,
      eq(trailMaintenanceReports.id, trailMaintenancePhotos.reportId),
    )
    .where(eq(trailMaintenanceReports.id, reportId))
    .groupBy(trailMaintenanceReports.id, trailSystems.name, trailSegments.name)
    .limit(1);

  if (!row) return null;

  const [photoRows, noteRows, eventRows] = await Promise.all([
    db
      .select()
      .from(trailMaintenancePhotos)
      .where(eq(trailMaintenancePhotos.reportId, reportId))
      .orderBy(asc(trailMaintenancePhotos.sortOrder), asc(trailMaintenancePhotos.createdAt)),
    db
      .select()
      .from(trailMaintenanceNotes)
      .where(eq(trailMaintenanceNotes.reportId, reportId))
      .orderBy(desc(trailMaintenanceNotes.createdAt)),
    db
      .select()
      .from(trailMaintenanceEvents)
      .where(eq(trailMaintenanceEvents.reportId, reportId))
      .orderBy(desc(trailMaintenanceEvents.createdAt)),
  ]);

  const photos = await Promise.all(
    photoRows.map(async (photo) => ({
      id: photo.id,
      url: await getTrailPhotoSignedUrl({
        bucketName: photo.bucketName,
        objectKey: photo.objectKey,
      }),
      originalFilename: photo.originalFilename,
      contentType: photo.contentType,
      byteSize: photo.byteSize,
    })),
  );

  return {
    id: row.report.id,
    publicId: row.report.publicId,
    issueType: row.report.issueType,
    issueTypeLabel: issueTypeLabel(row.report.issueType, row.report.issueTypeOther),
    status: row.report.status,
    statusLabel: trailIssueStatusLabels[row.report.status],
    priority: row.report.priority,
    priorityLabel: trailIssuePriorityLabels[row.report.priority],
    trailSystemName: row.systemName,
    trailSegmentName: row.segmentName,
    observedAt: row.report.observedAt.toISOString(),
    createdAt: row.report.createdAt.toISOString(),
    photoCount: row.photoCount,
    latitude: row.report.latitude,
    longitude: row.report.longitude,
    locationNotes: row.report.locationNotes,
    description: row.report.description,
    reporterName: row.report.reporterName,
    reporterContact: row.report.reporterContact,
    photos,
    notes: noteRows.map((note) => ({
      id: note.id,
      note: note.note,
      authorEmail: note.authorEmail,
      createdAt: note.createdAt.toISOString(),
    })),
    events: eventRows.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorLabel: event.actorLabel,
      details: event.details ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function getPublicTrailMaintenanceReport(
  publicId: string,
): Promise<PublicTrailMaintenanceReportDetail | null> {
  const normalizedPublicId = publicId.trim().toUpperCase();
  const [row] = await db
    .select({
      report: trailMaintenanceReports,
      systemName: trailSystems.name,
      segmentName: trailSegments.name,
    })
    .from(trailMaintenanceReports)
    .innerJoin(trailSystems, eq(trailMaintenanceReports.trailSystemId, trailSystems.id))
    .leftJoin(trailSegments, eq(trailMaintenanceReports.trailSegmentId, trailSegments.id))
    .where(eq(trailMaintenanceReports.publicId, normalizedPublicId))
    .limit(1);

  if (!row) return null;

  const photoRows = await db
    .select()
    .from(trailMaintenancePhotos)
    .where(eq(trailMaintenancePhotos.reportId, row.report.id))
    .orderBy(asc(trailMaintenancePhotos.sortOrder), asc(trailMaintenancePhotos.createdAt));

  const photos = await Promise.all(
    photoRows.map(async (photo) => ({
      id: photo.id,
      url: await getTrailPhotoSignedUrl({
        bucketName: photo.bucketName,
        objectKey: photo.objectKey,
      }),
      originalFilename: photo.originalFilename,
      contentType: photo.contentType,
      byteSize: photo.byteSize,
    })),
  );

  return {
    publicId: row.report.publicId,
    issueTypeLabel: issueTypeLabel(row.report.issueType, row.report.issueTypeOther),
    status: row.report.status,
    statusLabel: trailIssueStatusLabels[row.report.status],
    priority: row.report.priority,
    priorityLabel: trailIssuePriorityLabels[row.report.priority],
    trailSystemName: row.systemName,
    trailSegmentName: row.segmentName,
    observedAt: row.report.observedAt.toISOString(),
    createdAt: row.report.createdAt.toISOString(),
    updatedAt: row.report.updatedAt.toISOString(),
    resolvedAt: row.report.resolvedAt?.toISOString() ?? null,
    latitude: row.report.latitude,
    longitude: row.report.longitude,
    locationNotes: row.report.locationNotes,
    description: row.report.description,
    photos,
  };
}

export async function updateTrailMaintenanceReport({
  reportId,
  input,
  actor,
}: {
  readonly reportId: string;
  readonly input: TrailMaintenanceUpdateInput;
  readonly actor: StaffActor;
}): Promise<void> {
  const staffUser = await resolveStaffUser(actor);
  const [current] = await db
    .select()
    .from(trailMaintenanceReports)
    .where(eq(trailMaintenanceReports.id, reportId))
    .limit(1);
  if (!current) throw new Error('Report not found');

  const nextStatus = input.status ?? current.status;
  const updates = {
    status: nextStatus,
    priority: input.priority ?? current.priority,
    resolvedAt: nextStatus === 'resolved' ? (current.resolvedAt ?? new Date()) : null,
    resolvedByUserId: nextStatus === 'resolved' ? (staffUser?.id ?? null) : null,
    updatedAt: new Date(),
  };

  await db
    .update(trailMaintenanceReports)
    .set(updates)
    .where(eq(trailMaintenanceReports.id, reportId));

  if (input.status && input.status !== current.status) {
    await db.insert(trailMaintenanceEvents).values({
      reportId,
      eventType: input.status === 'resolved' ? 'resolved' : 'status_changed',
      actorUserId: staffUser?.id ?? null,
      actorLabel: actorLabel(actor),
      details: {from: current.status, to: input.status},
      createdAt: new Date(),
    });
  }

  if (input.priority && input.priority !== current.priority) {
    await db.insert(trailMaintenanceEvents).values({
      reportId,
      eventType: 'priority_changed',
      actorUserId: staffUser?.id ?? null,
      actorLabel: actorLabel(actor),
      details: {from: current.priority, to: input.priority},
      createdAt: new Date(),
    });
  }

  if (input.internalNote) {
    await addTrailMaintenanceNote({reportId, note: input.internalNote, actor});
  }
}

export async function addTrailMaintenanceNote({
  reportId,
  note,
  actor,
}: {
  readonly reportId: string;
  readonly note: string;
  readonly actor: StaffActor;
}): Promise<void> {
  const staffUser = await resolveStaffUser(actor);
  await db.insert(trailMaintenanceNotes).values({
    reportId,
    authorUserId: staffUser?.id ?? null,
    authorEmail: actor.email ?? null,
    note,
    createdAt: new Date(),
  });
  await db.insert(trailMaintenanceEvents).values({
    reportId,
    eventType: 'note_added',
    actorUserId: staffUser?.id ?? null,
    actorLabel: actorLabel(actor),
    details: {noteLength: note.length},
    createdAt: new Date(),
  });
}

export async function markCountyEmailGenerated({
  reportId,
  actor,
}: {
  readonly reportId: string;
  readonly actor: StaffActor;
}): Promise<void> {
  const staffUser = await resolveStaffUser(actor);
  await db
    .update(trailMaintenanceReports)
    .set({
      status: 'county_needed',
      countyEmailGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(trailMaintenanceReports.id, reportId));

  await db.insert(trailMaintenanceEvents).values({
    reportId,
    eventType: 'county_email_generated',
    actorUserId: staffUser?.id ?? null,
    actorLabel: actorLabel(actor),
    createdAt: new Date(),
  });
}

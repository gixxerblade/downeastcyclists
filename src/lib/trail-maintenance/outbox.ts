import {createCollection, createIndexedDB, indexedDBCollectionOptions} from '@tanstack/react-db';
import {z} from 'zod';

import {
  TRAIL_MAINTENANCE_PHOTO_LIMIT,
  TRAIL_MAINTENANCE_PHOTO_MAX_BYTES,
  trailMaintenancePhotoContentTypes,
} from './constants';
import {publicTrailMaintenanceReportSchema} from './validation';

export const trailOutboxSchema = z.object({
  id: z.string().uuid(),
  input: z.record(z.string()),
  photos: z.array(z.instanceof(Blob)).max(TRAIL_MAINTENANCE_PHOTO_LIMIT),
  filenames: z.array(z.string()),
  status: z.enum(['queued', 'submitting', 'needs-check', 'failed', 'submitted']),
  turnstileToken: z.string(),
  uploadToken: z.string().optional(),
  publicId: z.string().optional(),
  message: z.string(),
  attempts: z.number(),
  nextAttemptAt: z.number(),
  createdAt: z.number(),
});
export type TrailOutboxReport = z.infer<typeof trailOutboxSchema>;

export async function openTrailOutbox(name = 'dec-trail-reports') {
  const db = await createIndexedDB({name, version: 1, stores: ['reports']});
  const reports = createCollection(
    indexedDBCollectionOptions({
      db,
      name: 'reports',
      schema: trailOutboxSchema,
      getKey: (report) => report.id,
    }),
  );
  await reports.preload();
  return {
    reports,
    close: async () => {
      await reports.cleanup();
      db.close();
    },
  };
}
let outbox: ReturnType<typeof openTrailOutbox> | undefined;
export function getTrailOutbox() {
  outbox ??= openTrailOutbox().catch((error: unknown) => {
    outbox = undefined;
    throw error;
  });
  return outbox;
}

export async function saveTrailReport(
  input: Record<string, string>,
  photos: File[],
  turnstileToken: string,
) {
  const parsed = publicTrailMaintenanceReportSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Invalid report');
  if (photos.length > TRAIL_MAINTENANCE_PHOTO_LIMIT)
    throw new Error(`Upload up to ${TRAIL_MAINTENANCE_PHOTO_LIMIT} photos`);
  for (const photo of photos) {
    if (photo.size > TRAIL_MAINTENANCE_PHOTO_MAX_BYTES)
      throw new Error('Photos must be no larger than 20 MB');
    if (!trailMaintenancePhotoContentTypes.includes(photo.type))
      throw new Error('Photos must be JPEG, PNG, or WebP images');
  }
  const {reports} = await getTrailOutbox();
  const id = crypto.randomUUID();
  await reports.insert({
    id,
    input: {...input, observedAt: parsed.data.observedAt.toISOString()},
    photos,
    filenames: photos.map((photo) => photo.name),
    turnstileToken,
    status: 'queued',
    message: 'Saved on this phone—waiting to send.',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  }).isPersisted.promise;
  return id;
}

export async function updateTrailOutbox(id: string, values: Partial<TrailOutboxReport>) {
  const {reports} = await getTrailOutbox();
  await reports.update(id, (draft) => {
    Object.assign(draft, values);
  }).isPersisted.promise;
}

export async function retryTrailReport(id: string, turnstileToken?: string) {
  await updateTrailOutbox(id, {
    status: 'queued',
    attempts: 0,
    nextAttemptAt: 0,
    ...(turnstileToken === undefined ? {} : {turnstileToken, uploadToken: undefined}),
    message: 'Saved on this phone—waiting to send.',
  });
  await processTrailOutbox();
}

const uploadSessionSchema = z.object({
  uploadToken: z.string(),
  publicId: z.string(),
  uploads: z.array(
    z.object({uploadUrl: z.string().url(), contentType: z.string(), sortOrder: z.number().int()}),
  ),
});
class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function requestJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({error: z.string()}).safeParse(value);
    throw new SubmissionError(
      error.success ? error.data.error : 'Report could not be submitted',
      response.status,
    );
  }
  return value;
}
async function markSubmitted(report: TrailOutboxReport, publicId: string) {
  await updateTrailOutbox(report.id, {
    status: 'submitted',
    publicId,
    photos: [],
    turnstileToken: '',
    uploadToken: undefined,
    message: 'Report submitted with all attached images. DEC can now review it.',
  });
}

export async function submitQueuedTrailReport(report: TrailOutboxReport) {
  try {
    await updateTrailOutbox(report.id, {
      status: 'submitting',
      message: 'Submitting report and images…',
    });
    if (report.uploadToken) {
      const receipt = z.object({submitted: z.boolean(), publicId: z.string()}).parse(
        await requestJson('/api/trail-maintenance/reports/receipt', {
          uploadToken: report.uploadToken,
        }),
      );
      if (receipt.submitted) {
        await markSubmitted(report, receipt.publicId);
        return;
      }
    }
    const session = uploadSessionSchema.parse(
      await requestJson('/api/trail-maintenance/reports/uploads', {
        uploadToken: report.uploadToken,
        turnstileToken: report.turnstileToken || undefined,
        files: report.photos.map((photo, index) => ({
          originalFilename: report.filenames[index],
          contentType: photo.type,
          byteSize: photo.size,
        })),
      }),
    );
    // Persist authorization before transferring any bytes, so a reload can resume safely.
    await updateTrailOutbox(report.id, {
      uploadToken: session.uploadToken,
      publicId: session.publicId,
      turnstileToken: '',
    });
    if (session.uploads.length !== report.photos.length)
      throw new SubmissionError('Invalid photo upload response', 400);
    for (const [index, upload] of session.uploads.entries()) {
      const photo = report.photos[index];
      if (!photo || upload.sortOrder !== index || upload.contentType !== photo.type)
        throw new SubmissionError('Invalid photo upload mapping', 400);
      await updateTrailOutbox(report.id, {
        message: `Uploading image ${index + 1} of ${report.photos.length}…`,
      });
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {'Content-Type': upload.contentType},
        body: photo,
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error('Image upload interrupted. We will retry.');
    }
    await updateTrailOutbox(report.id, {message: 'Images uploaded—finishing submission…'});
    const result = z.object({publicId: z.string()}).parse(
      await requestJson('/api/trail-maintenance/reports', {
        ...report.input,
        uploadToken: session.uploadToken,
      }),
    );
    await markSubmitted(report, result.publicId);
  } catch (error) {
    const needsCheck = error instanceof SubmissionError && error.status === 403;
    const permanent =
      error instanceof SubmissionError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429;
    await updateTrailOutbox(report.id, {
      status: needsCheck ? 'needs-check' : permanent ? 'failed' : 'queued',
      attempts: report.attempts + 1,
      nextAttemptAt: Date.now() + Math.min(300_000, 15_000 * 2 ** Math.min(report.attempts, 5)),
      message: needsCheck
        ? 'Saved on this phone. Complete the bot check below to continue sending.'
        : permanent
          ? error.message
          : 'Saved on this phone—connection interrupted. We will retry automatically. DEC has not confirmed receipt yet.',
    });
  }
}

let running = false;
export async function processTrailOutbox() {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const process = async () => {
      // Refresh from disk under the cross-tab lock before choosing jobs.
      const current = await openTrailOutbox();
      try {
        for (const report of current.reports.toArray) {
          if (
            (report.status === 'queued' || report.status === 'submitting') &&
            report.nextAttemptAt <= Date.now()
          ) {
            await submitQueuedTrailReport(report);
          }
        }
      } finally {
        await current.close();
      }
    };
    if (navigator.locks)
      await navigator.locks.request(
        'dec-trail-report-upload',
        {ifAvailable: true},
        async (lock) => {
          if (lock) await process();
        },
      );
    else await process();
  } finally {
    running = false;
  }
}

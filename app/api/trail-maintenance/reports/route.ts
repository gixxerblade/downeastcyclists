import {NextRequest, NextResponse} from 'next/server';

import {
  TRAIL_MAINTENANCE_PHOTO_LIMIT,
  TRAIL_MAINTENANCE_PHOTO_MAX_BYTES,
} from '@/src/lib/trail-maintenance/constants';
import {sendTrailMaintenanceNotification} from '@/src/lib/trail-maintenance/notifications';
import {
  storeTrailMaintenancePhotos,
  TrailPhotoValidationError,
} from '@/src/lib/trail-maintenance/r2';
import {
  createTrailMaintenanceReport,
  getTrailMaintenanceReportDetail,
  getTrailMaintenanceReportRecipients,
} from '@/src/lib/trail-maintenance/repository';
import {verifyTrailMaintenanceTurnstile} from '@/src/lib/trail-maintenance/turnstile';
import {publicTrailMaintenanceReportSchema} from '@/src/lib/trail-maintenance/validation';

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip');
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function getPhotoFiles(formData: FormData): File[] {
  return formData
    .getAll('photos')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length'));
    const maximumRequestBytes =
      TRAIL_MAINTENANCE_PHOTO_LIMIT * TRAIL_MAINTENANCE_PHOTO_MAX_BYTES + 1024 * 1024;
    if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
      return NextResponse.json({error: 'Upload is too large'}, {status: 413});
    }

    const formData = await request.formData();
    const photoFiles = getPhotoFiles(formData);
    if (photoFiles.length > TRAIL_MAINTENANCE_PHOTO_LIMIT) {
      return NextResponse.json(
        {error: `Upload up to ${TRAIL_MAINTENANCE_PHOTO_LIMIT} photos`},
        {status: 400},
      );
    }

    const parsed = publicTrailMaintenanceReportSchema.safeParse({
      issueType: formValue(formData, 'issueType'),
      issueTypeOther: formValue(formData, 'issueTypeOther'),
      observedAt: formValue(formData, 'observedAt'),
      trailSystemSlug: formValue(formData, 'trailSystemSlug'),
      trailSegmentSlug: formValue(formData, 'trailSegmentSlug'),
      locationSource: formValue(formData, 'locationSource') || 'manual',
      locationNotes: formValue(formData, 'locationNotes'),
      latitude: formValue(formData, 'latitude'),
      longitude: formValue(formData, 'longitude'),
      locationAccuracyMeters: formValue(formData, 'locationAccuracyMeters'),
      description: formValue(formData, 'description'),
      reporterName: formValue(formData, 'reporterName'),
      reporterContact: formValue(formData, 'reporterContact'),
      turnstileToken:
        formValue(formData, 'cf-turnstile-response') || formValue(formData, 'turnstileToken'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {error: parsed.error.issues[0]?.message || 'Invalid report'},
        {status: 400},
      );
    }

    const remoteIp = getClientIp(request);
    const turnstile = await verifyTrailMaintenanceTurnstile({
      token: parsed.data.turnstileToken,
      remoteIp,
    });
    if (!turnstile.ok) {
      return NextResponse.json({error: turnstile.reason || 'Bot check failed'}, {status: 403});
    }

    const publicId = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const photos = await storeTrailMaintenancePhotos({
      publicId,
      files: photoFiles,
    });

    const created = await createTrailMaintenanceReport({
      input: parsed.data,
      photos,
      publicId,
      userAgent: request.headers.get('user-agent'),
      remoteIp,
    });

    const report = await getTrailMaintenanceReportDetail(created.id);
    if (report) {
      const recipients = await getTrailMaintenanceReportRecipients();
      await sendTrailMaintenanceNotification({report, recipients});
    }

    return NextResponse.json(
      {
        publicId: created.publicId,
        reportUrl: `/report-trail-issue/${created.publicId}`,
      },
      {status: 201},
    );
  } catch (error) {
    console.error('[TrailMaintenance] Failed to submit report:', error);
    if (error instanceof TrailPhotoValidationError) {
      return NextResponse.json({error: error.message}, {status: 400});
    }
    return NextResponse.json({error: 'Failed to submit report'}, {status: 500});
  }
}

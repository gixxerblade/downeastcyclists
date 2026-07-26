import {NextRequest, NextResponse} from 'next/server';

import {TRAIL_MAINTENANCE_PHOTO_LIMIT} from '@/src/lib/trail-maintenance/constants';
import {sendTrailMaintenanceNotification} from '@/src/lib/trail-maintenance/notifications';
import {storeTrailMaintenancePhotos} from '@/src/lib/trail-maintenance/r2';
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
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, TRAIL_MAINTENANCE_PHOTO_LIMIT);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
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
      files: getPhotoFiles(formData),
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
    const message = error instanceof Error ? error.message : 'Failed to submit report';
    console.error('[TrailMaintenance] Failed to submit report:', error);
    return NextResponse.json({error: message}, {status: 500});
  }
}

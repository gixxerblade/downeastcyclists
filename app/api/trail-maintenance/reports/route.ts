import {NextRequest, NextResponse} from 'next/server';

import {sendTrailMaintenanceNotification} from '@/src/lib/trail-maintenance/notifications';
import {
  storeTrailMaintenancePhotosFromUploads,
  TrailPhotoValidationError,
} from '@/src/lib/trail-maintenance/r2';
import {
  createTrailMaintenanceReport,
  getTrailMaintenanceReportDetail,
  getTrailMaintenanceReportRecipients,
} from '@/src/lib/trail-maintenance/repository';
import {getTrailMaintenanceClientIp} from '@/src/lib/trail-maintenance/request';
import {verifyTrailPhotoUploadSession} from '@/src/lib/trail-maintenance/upload-session';
import {publicTrailMaintenanceReportSubmissionSchema} from '@/src/lib/trail-maintenance/validation';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({error: 'Invalid report'}, {status: 400});
    }

    const parsed = publicTrailMaintenanceReportSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {error: parsed.error.issues[0]?.message || 'Invalid report'},
        {status: 400},
      );
    }

    const uploadSession = verifyTrailPhotoUploadSession(parsed.data.uploadToken);
    if (!uploadSession.ok) {
      return NextResponse.json(
        {error: 'Photo upload session is invalid or expired. Please try again.'},
        {status: 400},
      );
    }

    const {uploadToken: _uploadToken, ...input} = parsed.data;
    const photos = await storeTrailMaintenancePhotosFromUploads({
      publicId: uploadSession.payload.publicId,
      files: uploadSession.payload.files,
    });
    const remoteIp = getTrailMaintenanceClientIp(request);
    const created = await createTrailMaintenanceReport({
      input,
      photos,
      publicId: uploadSession.payload.publicId,
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

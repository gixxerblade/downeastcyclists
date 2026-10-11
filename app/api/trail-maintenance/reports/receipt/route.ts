import {NextRequest, NextResponse} from 'next/server';

import {getPublicTrailMaintenanceReport} from '@/src/lib/trail-maintenance/repository';
import {verifyTrailPhotoUploadSession} from '@/src/lib/trail-maintenance/upload-session';

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== 'object' ||
    !('uploadToken' in body) ||
    typeof body.uploadToken !== 'string'
  ) {
    return NextResponse.json({error: 'Invalid receipt request'}, {status: 400});
  }
  const session = verifyTrailPhotoUploadSession(body.uploadToken, new Date(), 'receipt');
  if (!session.ok) return NextResponse.json({error: 'Upload authorization expired'}, {status: 403});
  const report = await getPublicTrailMaintenanceReport(session.payload.publicId);
  return NextResponse.json({submitted: Boolean(report), publicId: session.payload.publicId});
}

import {NextRequest, NextResponse} from 'next/server';

import {createTrailPhotoUploadTargets} from '@/src/lib/trail-maintenance/r2';
import {getTrailMaintenanceClientIp} from '@/src/lib/trail-maintenance/request';
import {verifyTrailMaintenanceTurnstile} from '@/src/lib/trail-maintenance/turnstile';
import {
  createTrailPhotoUploadSession,
  trailPhotoUploadRequestSchema,
} from '@/src/lib/trail-maintenance/upload-session';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({error: 'Invalid upload request'}, {status: 400});
    }

    const parsed = trailPhotoUploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {error: parsed.error.issues[0]?.message || 'Invalid upload request'},
        {status: 400},
      );
    }

    const turnstile = await verifyTrailMaintenanceTurnstile({
      token: parsed.data.turnstileToken,
      remoteIp: getTrailMaintenanceClientIp(request),
    });
    if (!turnstile.ok) {
      return NextResponse.json({error: turnstile.reason || 'Bot check failed'}, {status: 403});
    }

    const now = new Date();
    const session = createTrailPhotoUploadSession(parsed.data.files, now);
    const uploads = await createTrailPhotoUploadTargets({files: session.payload.files, now});

    return NextResponse.json({uploadToken: session.token, uploads}, {status: 201});
  } catch (error) {
    console.error('[TrailMaintenance] Failed to create photo upload session:', error);
    return NextResponse.json({error: 'Failed to prepare photo uploads'}, {status: 500});
  }
}

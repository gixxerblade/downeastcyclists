import {NextResponse} from 'next/server';

import {getTrailMaintenanceOptions} from '@/src/lib/trail-maintenance/repository';

export async function GET() {
  try {
    return NextResponse.json({trailSystems: await getTrailMaintenanceOptions()});
  } catch (error) {
    console.error('[TrailMaintenance] Failed to load options:', error);
    return NextResponse.json({error: 'Failed to load trail options'}, {status: 500});
  }
}

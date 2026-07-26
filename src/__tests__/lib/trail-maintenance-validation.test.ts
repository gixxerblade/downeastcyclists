import {describe, expect, it} from 'vitest';

import {publicTrailMaintenanceReportSchema} from '@/src/lib/trail-maintenance/validation';

const baseReport = {
  issueType: 'trail_obstruction',
  observedAt: '2026-07-25T10:00',
  trailSystemSlug: 'big-branch-bike-park',
  trailSegmentSlug: 'phase-1-green-ricochet',
  locationSource: 'manual',
  locationNotes: 'Near the first bridge',
};

describe('publicTrailMaintenanceReportSchema', () => {
  it('accepts a report with manual location notes', () => {
    const result = publicTrailMaintenanceReportSchema.safeParse(baseReport);

    expect(result.success).toBe(true);
  });

  it('accepts a report with GPS coordinates instead of location notes', () => {
    const result = publicTrailMaintenanceReportSchema.safeParse({
      ...baseReport,
      locationNotes: '',
      locationSource: 'browser_geolocation',
      latitude: '34.754',
      longitude: '-77.43',
      locationAccuracyMeters: '18',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a report without notes or coordinates', () => {
    const result = publicTrailMaintenanceReportSchema.safeParse({
      ...baseReport,
      locationNotes: '',
    });

    expect(result.success).toBe(false);
  });

  it('requires an issue description when issue type is other', () => {
    const result = publicTrailMaintenanceReportSchema.safeParse({
      ...baseReport,
      issueType: 'other',
      issueTypeOther: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects coordinates outside valid ranges', () => {
    const result = publicTrailMaintenanceReportSchema.safeParse({
      ...baseReport,
      locationSource: 'browser_geolocation',
      latitude: '100',
      longitude: '-200',
    });

    expect(result.success).toBe(false);
  });
});

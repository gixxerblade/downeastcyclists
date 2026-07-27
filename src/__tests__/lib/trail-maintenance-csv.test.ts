import {describe, expect, it} from 'vitest';

import {generateTrailMaintenanceReportsCsv} from '@/src/lib/trail-maintenance/csv';
import type {TrailMaintenanceReportSummary} from '@/src/lib/trail-maintenance/repository';

const report: TrailMaintenanceReportSummary = {
  id: 'report-1',
  publicId: 'ABC123',
  issueType: 'other',
  issueTypeLabel: 'Tree, large',
  status: 'new',
  statusLabel: 'New',
  priority: 'normal',
  priorityLabel: 'Normal',
  trailSystemName: 'Big Branch Bike Park',
  trailSegmentName: 'Pine Loop',
  observedAt: '2026-07-26T14:30:00.000Z',
  createdAt: '2026-07-26T15:00:00.000Z',
  photoCount: 2,
  latitude: 34.75,
  longitude: -77.42,
  locationNotes: 'Near the "bridge"\nblocking the trail',
};

describe('generateTrailMaintenanceReportsCsv', () => {
  it('exports report columns with quotes, commas, and line breaks escaped', () => {
    const csv = generateTrailMaintenanceReportsCsv([report]);

    expect(csv).toContain('"Report ID","Issue Type","Status","Priority"');
    expect(csv).toContain('"Tree, large"');
    expect(csv).toContain('"Near the ""bridge""\nblocking the trail"');
    expect(csv).toContain('"-77.42"');
    expect(csv).not.toContain('"\'-77.42"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('exports headers when there are no matching reports', () => {
    const csv = generateTrailMaintenanceReportsCsv([]);

    expect(csv).toContain('"Report ID"');
    expect(csv).not.toContain('ABC123');
  });

  it('prevents user-entered values from becoming spreadsheet formulas', () => {
    const csv = generateTrailMaintenanceReportsCsv([
      {...report, issueTypeLabel: '=HYPERLINK("https://example.com")'},
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
  });
});

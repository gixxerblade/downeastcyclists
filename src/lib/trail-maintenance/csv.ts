import type {TrailMaintenanceReportSummary} from './repository';

const csvHeaders = [
  'Report ID',
  'Issue Type',
  'Status',
  'Priority',
  'Trail System',
  'Trail Segment',
  'Observed At',
  'Submitted At',
  'Photo Count',
  'Latitude',
  'Longitude',
  'Location Notes',
] as const;

function protectSpreadsheetFormula(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string | number | null): string {
  const stringValue = value === null ? '' : String(value);
  const protectedValue = typeof value === 'string' ? protectSpreadsheetFormula(value) : stringValue;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function generateTrailMaintenanceReportsCsv(
  reports: ReadonlyArray<TrailMaintenanceReportSummary>,
): string {
  const rows = reports.map((report) => [
    report.publicId,
    report.issueTypeLabel,
    report.statusLabel,
    report.priorityLabel,
    report.trailSystemName,
    report.trailSegmentName,
    report.observedAt,
    report.createdAt,
    report.photoCount,
    report.latitude,
    report.longitude,
    report.locationNotes,
  ]);

  return [
    csvHeaders.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');
}

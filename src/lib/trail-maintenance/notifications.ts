import {Resend} from 'resend';

import {getSiteUrl} from '@/src/lib/site-url';

import type {TrailMaintenanceReportDetail} from './repository';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendTrailMaintenanceNotification({
  report,
  recipients,
}: {
  readonly report: TrailMaintenanceReportDetail;
  readonly recipients: readonly string[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || recipients.length === 0) {
    console.warn('[TrailMaintenance] Skipping notification: Resend or recipients missing');
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? 'Down East Cyclists <noreply@downeastcyclists.com>';
  const dashboardUrl = `${getSiteUrl()}/dashboard`;
  const subject = `New trail report ${report.publicId}: ${report.issueTypeLabel}`;
  const location =
    report.latitude && report.longitude
      ? `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`
      : report.locationNotes || 'Location notes unavailable';

  const text = [
    `New trail maintenance report ${report.publicId}`,
    '',
    `Issue: ${report.issueTypeLabel}`,
    `Trail: ${report.trailSystemName}${report.trailSegmentName ? ` - ${report.trailSegmentName}` : ''}`,
    `Location: ${location}`,
    `Photos: ${report.photoCount}`,
    '',
    'Open the organizer dashboard:',
    dashboardUrl,
  ].join('\n');

  const html = `
    <p>New trail maintenance report <strong>${escapeHtml(report.publicId)}</strong></p>
    <p><strong>Issue:</strong> ${escapeHtml(report.issueTypeLabel)}</p>
    <p><strong>Trail:</strong> ${escapeHtml(report.trailSystemName)}${
      report.trailSegmentName ? ` - ${escapeHtml(report.trailSegmentName)}` : ''
    }</p>
    <p><strong>Location:</strong> ${escapeHtml(location)}</p>
    <p><strong>Photos:</strong> ${report.photoCount}</p>
    <p><a href="${escapeHtml(dashboardUrl)}">Open organizer dashboard</a></p>
  `.trim();

  const {error} = await resend.emails.send(
    {
      from,
      to: [...recipients],
      subject,
      html,
      text,
    },
    {idempotencyKey: `trail-maintenance/${report.publicId}`},
  );

  if (error) {
    console.error('[TrailMaintenance] Failed to send notification:', error);
  }
}

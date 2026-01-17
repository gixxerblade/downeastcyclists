import {Context, Effect, Layer, pipe} from 'effect';

import {ExportError, FirestoreError} from './errors';
import {FirestoreService} from './firestore.service';
import type {ExportOptions, MemberWithMembership} from './schemas';

// Service interface
export interface ExportService {
  readonly generateCSV: (
    options: ExportOptions,
  ) => Effect.Effect<string, ExportError | FirestoreError>;

  readonly generateJSON: (
    options: ExportOptions,
  ) => Effect.Effect<string, ExportError | FirestoreError>;
}

// Service tag
export const ExportService = Context.GenericTag<ExportService>('ExportService');

// CSV helper
const escapeCSV = (value: string | null | undefined): string => {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Implementation
const make = Effect.gen(function* () {
  const firestore = yield* FirestoreService;

  const fetchMembers = (options: ExportOptions) =>
    pipe(
      firestore.getAllMemberships({
        status: options.statusFilter,
        pageSize: 1000, // Large batch for export
      }),
      Effect.map(({members}) => members),
    );

  const memberToRow = (member: MemberWithMembership, options: ExportOptions): string[] => {
    const row: string[] = [member.card?.membershipNumber || '', member.user?.name || ''];

    if (options.includeEmail) {
      row.push(member.user?.email || '');
    }

    if (options.includePhone) {
      row.push(member.user?.phone || '');
    }

    if (options.includeAddress) {
      row.push(member.user?.address?.street || '');
      row.push(member.user?.address?.city || '');
      row.push(member.user?.address?.state || '');
      row.push(member.user?.address?.zip || '');
    }

    row.push(member.membership?.planType || '');
    row.push(member.membership?.status || '');

    // Handle Firestore timestamps
    const startDate = member.membership?.startDate;
    const endDate = member.membership?.endDate;

    row.push(
      startDate
        ? (startDate.toDate?.() ? startDate.toDate() : new Date(startDate as unknown as string))
            .toISOString()
            .split('T')[0]
        : '',
    );
    row.push(
      endDate
        ? (endDate.toDate?.() ? endDate.toDate() : new Date(endDate as unknown as string))
            .toISOString()
            .split('T')[0]
        : '',
    );
    row.push(member.membership?.autoRenew ? 'Yes' : 'No');

    return row;
  };

  return ExportService.of({
    generateCSV: (options) =>
      Effect.gen(function* () {
        const members = yield* fetchMembers(options);

        // Build header
        const headers: string[] = ['Membership Number', 'Name'];
        if (options.includeEmail) headers.push('Email');
        if (options.includePhone) headers.push('Phone');
        if (options.includeAddress) {
          headers.push('Street', 'City', 'State', 'ZIP');
        }
        headers.push('Plan Type', 'Status', 'Start Date', 'End Date', 'Auto-Renew');

        // Build rows
        const rows = members.map((m) => memberToRow(m, options).map(escapeCSV).join(','));

        // Combine
        const csv = [headers.join(','), ...rows].join('\n');

        yield* Effect.log(`Generated CSV export with ${members.length} members`);

        return csv;
      }),

    generateJSON: (options) =>
      Effect.gen(function* () {
        const members = yield* fetchMembers(options);

        const exportData = members.map((member) => {
          const startDate = member.membership?.startDate;
          const endDate = member.membership?.endDate;

          const data: Record<string, unknown> = {
            membershipNumber: member.card?.membershipNumber,
            name: member.user?.name,
            planType: member.membership?.planType,
            status: member.membership?.status,
            startDate: startDate
              ? (startDate.toDate?.()
                  ? startDate.toDate()
                  : new Date(startDate as unknown as string)
                ).toISOString()
              : null,
            endDate: endDate
              ? (endDate.toDate?.()
                  ? endDate.toDate()
                  : new Date(endDate as unknown as string)
                ).toISOString()
              : null,
            autoRenew: member.membership?.autoRenew,
          };

          if (options.includeEmail) {
            data.email = member.user?.email;
          }

          if (options.includePhone) {
            data.phone = member.user?.phone;
          }

          if (options.includeAddress) {
            data.address = member.user?.address;
          }

          return data;
        });

        yield* Effect.log(`Generated JSON export with ${members.length} members`);

        return JSON.stringify(exportData, null, 2);
      }),
  });
});

// Live layer
export const ExportServiceLive = Layer.effect(ExportService, make);

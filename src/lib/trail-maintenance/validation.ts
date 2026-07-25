import {z} from 'zod';

import {
  trailIssuePriorities,
  trailIssueStatuses,
  trailIssueTypes,
  trailLocationSources,
} from './constants';

const trimmedOptional = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const numberFromOptionalString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? Number(trimmed) : undefined;
}, z.number().finite().optional());

export const publicTrailMaintenanceReportSchema = z
  .object({
    issueType: z.enum(trailIssueTypes),
    issueTypeOther: trimmedOptional,
    observedAt: z
      .string()
      .trim()
      .min(1, 'Observed date and time is required')
      .transform((value) => new Date(value))
      .pipe(z.date()),
    trailSystemSlug: z.string().trim().min(1, 'Trail system is required'),
    trailSegmentSlug: z.string().trim().min(1, 'Trail is required'),
    locationSource: z.enum(trailLocationSources).default('manual'),
    locationNotes: trimmedOptional,
    latitude: numberFromOptionalString,
    longitude: numberFromOptionalString,
    locationAccuracyMeters: numberFromOptionalString,
    description: trimmedOptional,
    reporterName: trimmedOptional,
    reporterContact: trimmedOptional,
    turnstileToken: trimmedOptional,
  })
  .superRefine((value, context) => {
    const hasCoordinates = value.latitude !== undefined && value.longitude !== undefined;
    if (!hasCoordinates && !value.locationNotes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locationNotes'],
        message: 'Add location notes or use current location',
      });
    }

    if (value.issueType === 'other' && !value.issueTypeOther) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['issueTypeOther'],
        message: 'Describe the issue type',
      });
    }

    if (value.latitude !== undefined && (value.latitude < -90 || value.latitude > 90)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Latitude is out of range',
      });
    }

    if (value.longitude !== undefined && (value.longitude < -180 || value.longitude > 180)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['longitude'],
        message: 'Longitude is out of range',
      });
    }
  });

export const trailMaintenanceListQuerySchema = z.object({
  status: z.enum(trailIssueStatuses).optional(),
  priority: z.enum(trailIssuePriorities).optional(),
  issueType: z.enum(trailIssueTypes).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const trailMaintenanceUpdateSchema = z.object({
  status: z.enum(trailIssueStatuses).optional(),
  priority: z.enum(trailIssuePriorities).optional(),
  internalNote: z.string().trim().max(4000).optional(),
});

export type PublicTrailMaintenanceReportInput = z.infer<typeof publicTrailMaintenanceReportSchema>;
export type TrailMaintenanceListQuery = z.infer<typeof trailMaintenanceListQuerySchema>;
export type TrailMaintenanceUpdateInput = z.infer<typeof trailMaintenanceUpdateSchema>;

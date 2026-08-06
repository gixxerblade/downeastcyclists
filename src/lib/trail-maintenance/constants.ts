export const TRAIL_SYSTEM_BIG_BRANCH = 'big-branch-bike-park';

export const TRAIL_MAINTENANCE_PHOTO_LIMIT = 3;
export const TRAIL_MAINTENANCE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const TRAIL_MAINTENANCE_UPLOAD_TTL_SECONDS = 15 * 60;
export const TRAIL_MAINTENANCE_TURNSTILE_ACTION = 'trail_report';

export const trailMaintenancePhotoContentTypes: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const trailIssueTypes = [
  'trail_obstruction',
  'erosion_or_hole',
  'standing_water_or_drainage',
  'overgrown_vegetation',
  'damaged_feature',
  'missing_or_damaged_sign',
  'trash_or_vandalism',
  'other',
] as const;

export const trailIssueStatuses = [
  'new',
  'triaged',
  'assigned',
  'county_needed',
  'county_contacted',
  'in_progress',
  'resolved',
  'closed_no_action',
  'duplicate',
] as const;

export const trailIssuePriorities = ['low', 'normal', 'high', 'urgent'] as const;

export const trailLocationSources = [
  'browser_geolocation',
  'map_pin',
  'manual',
  'qr_prefill',
] as const;

export type TrailIssueType = (typeof trailIssueTypes)[number];
export type TrailIssueStatus = (typeof trailIssueStatuses)[number];
export type TrailIssuePriority = (typeof trailIssuePriorities)[number];
export type TrailLocationSource = (typeof trailLocationSources)[number];

export const trailIssueTypeLabels: Record<TrailIssueType, string> = {
  trail_obstruction: 'Trail obstruction',
  erosion_or_hole: 'Erosion or hole',
  standing_water_or_drainage: 'Standing water or poor drainage',
  overgrown_vegetation: 'Overgrown vegetation',
  damaged_feature: 'Damaged feature',
  missing_or_damaged_sign: 'Missing or damaged sign',
  trash_or_vandalism: 'Trash or vandalism',
  other: 'Other',
};

export const trailIssueStatusLabels: Record<TrailIssueStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  assigned: 'Assigned',
  county_needed: 'County needed',
  county_contacted: 'County contacted',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed_no_action: 'Closed - no action',
  duplicate: 'Duplicate',
};

export const trailIssuePriorityLabels: Record<TrailIssuePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const defaultTrailSystems = [
  {
    slug: TRAIL_SYSTEM_BIG_BRANCH,
    name: 'Big Branch Bike Park',
    segments: [
      {slug: 'phase-1-green-ricochet', name: 'Phase 1 Green (Ricochet)', colorLabel: 'Green'},
      {
        slug: 'phase-1-blue-ridge-runners-loop',
        name: 'Phase 1 Blue (Ridge Runners Loop)',
        colorLabel: 'Blue',
      },
      {
        slug: 'phase-2-blue-trail-dynamic',
        name: 'Phase 2 Blue (Trail Dynamic)',
        colorLabel: 'Blue',
      },
    ],
  },
] as const;

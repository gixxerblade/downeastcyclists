import {relations} from 'drizzle-orm';

import {
  auditLog,
  emailLog,
  membershipCards,
  memberships,
  trailMaintenanceEvents,
  trailMaintenanceNotes,
  trailMaintenancePhotos,
  trailMaintenanceReports,
  trailSegments,
  trailSystems,
  users,
} from './tables';

export const usersRelations = relations(users, ({many}) => ({
  memberships: many(memberships),
  membershipCards: many(membershipCards),
  auditLogs: many(auditLog),
  emailLogs: many(emailLog),
  assignedTrailMaintenanceReports: many(trailMaintenanceReports, {
    relationName: 'assignedTrailMaintenanceReports',
  }),
  resolvedTrailMaintenanceReports: many(trailMaintenanceReports, {
    relationName: 'resolvedTrailMaintenanceReports',
  }),
}));

export const membershipsRelations = relations(memberships, ({one, many}) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  cards: many(membershipCards),
}));

export const membershipCardsRelations = relations(membershipCards, ({one}) => ({
  user: one(users, {
    fields: [membershipCards.userId],
    references: [users.id],
  }),
  membership: one(memberships, {
    fields: [membershipCards.membershipId],
    references: [memberships.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({one}) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

export const emailLogRelations = relations(emailLog, ({one}) => ({
  user: one(users, {
    fields: [emailLog.userId],
    references: [users.id],
  }),
  membership: one(memberships, {
    fields: [emailLog.membershipId],
    references: [memberships.id],
  }),
}));

export const trailSystemsRelations = relations(trailSystems, ({many}) => ({
  segments: many(trailSegments),
  maintenanceReports: many(trailMaintenanceReports),
}));

export const trailSegmentsRelations = relations(trailSegments, ({one, many}) => ({
  trailSystem: one(trailSystems, {
    fields: [trailSegments.trailSystemId],
    references: [trailSystems.id],
  }),
  maintenanceReports: many(trailMaintenanceReports),
}));

export const trailMaintenanceReportsRelations = relations(
  trailMaintenanceReports,
  ({one, many}) => ({
    trailSystem: one(trailSystems, {
      fields: [trailMaintenanceReports.trailSystemId],
      references: [trailSystems.id],
    }),
    trailSegment: one(trailSegments, {
      fields: [trailMaintenanceReports.trailSegmentId],
      references: [trailSegments.id],
    }),
    assignedTo: one(users, {
      fields: [trailMaintenanceReports.assignedToUserId],
      references: [users.id],
      relationName: 'assignedTrailMaintenanceReports',
    }),
    resolvedBy: one(users, {
      fields: [trailMaintenanceReports.resolvedByUserId],
      references: [users.id],
      relationName: 'resolvedTrailMaintenanceReports',
    }),
    photos: many(trailMaintenancePhotos),
    notes: many(trailMaintenanceNotes),
    events: many(trailMaintenanceEvents),
  }),
);

export const trailMaintenancePhotosRelations = relations(trailMaintenancePhotos, ({one}) => ({
  report: one(trailMaintenanceReports, {
    fields: [trailMaintenancePhotos.reportId],
    references: [trailMaintenanceReports.id],
  }),
}));

export const trailMaintenanceNotesRelations = relations(trailMaintenanceNotes, ({one}) => ({
  report: one(trailMaintenanceReports, {
    fields: [trailMaintenanceNotes.reportId],
    references: [trailMaintenanceReports.id],
  }),
  author: one(users, {
    fields: [trailMaintenanceNotes.authorUserId],
    references: [users.id],
  }),
}));

export const trailMaintenanceEventsRelations = relations(trailMaintenanceEvents, ({one}) => ({
  report: one(trailMaintenanceReports, {
    fields: [trailMaintenanceEvents.reportId],
    references: [trailMaintenanceReports.id],
  }),
  actor: one(users, {
    fields: [trailMaintenanceEvents.actorUserId],
    references: [users.id],
  }),
}));

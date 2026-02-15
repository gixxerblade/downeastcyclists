import {relations} from 'drizzle-orm';

import {auditLog, membershipCards, memberships, users} from './tables';

export const usersRelations = relations(users, ({many}) => ({
  memberships: many(memberships),
  membershipCards: many(membershipCards),
  auditLogs: many(auditLog),
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

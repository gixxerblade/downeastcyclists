import {Effect, Layer} from 'effect';

import {AdminServiceLive} from './admin.service';
import {AuthServiceLive} from './auth.service';
import {MembershipCardServiceLive} from './card.service';
import {DatabaseService, DatabaseServiceLive} from './database.service';
import {FirestoreError} from './errors';
import type {DatabaseError} from './errors';
import {ExportServiceLive} from './export.service';
import {FirestoreService} from './firestore.service';
import {MembershipServiceLive} from './membership.service';
import {PortalServiceLive} from './portal.service';
import {QRServiceLive} from './qr.service';
import {StatsServiceLive} from './stats.service';
import {StripeServiceLive} from './stripe.service';
import {WebhookIdempotencyServiceLive} from './webhook-idempotency.service';

// Adapter: provides FirestoreService tag backed by DatabaseService (Postgres).
// This bridges services that still reference FirestoreService during migration.
// DatabaseError is mapped to FirestoreError so existing error handlers work.
const mapDbError = <A>(effect: Effect.Effect<A, DatabaseError>): Effect.Effect<A, FirestoreError> =>
  Effect.mapError(
    effect,
    (e) => new FirestoreError({code: e.code, message: e.message, cause: e.cause}),
  );

const FirestoreFromDatabaseLayer = Layer.effect(
  FirestoreService,
  Effect.gen(function* () {
    const db = yield* DatabaseService;

    return FirestoreService.of({
      getUser: (uid) => mapDbError(db.getUser(uid)),
      getUserByEmail: (email) => mapDbError(db.getUserByEmail(email)),
      getUserByStripeCustomerId: (cid) => mapDbError(db.getUserByStripeCustomerId(cid)),
      createUser: (uid, data) => mapDbError(db.createUser(uid, data)),
      updateUser: (uid, data) => mapDbError(db.updateUser(uid, data)),
      setUser: (uid, data, merge) => mapDbError(db.setUser(uid, data, merge)),
      upsertUserByStripeCustomer: (cid, email, defaults) =>
        mapDbError(db.upsertUserByStripeCustomer(cid, email, defaults)),
      getMembership: (uid, mid) => mapDbError(db.getMembership(uid, mid)),
      getActiveMembership: (uid) => mapDbError(db.getActiveMembership(uid)),
      setMembership: (uid, mid, data) => mapDbError(db.setMembership(uid, mid, data)),
      updateMembership: (uid, mid, data) => mapDbError(db.updateMembership(uid, mid, data)),
      deleteMembership: (uid, mid) => mapDbError(db.deleteMembership(uid, mid)),
      getAllMemberships: (params) => mapDbError(db.getAllMemberships(params)),
      getExpiringMemberships: (days) => mapDbError(db.getExpiringMemberships(days)),
      getMembershipCard: (uid) => mapDbError(db.getMembershipCard(uid)),
      setMembershipCard: (uid, card) => mapDbError(db.setMembershipCard(uid, card)),
      updateMembershipCard: (uid, data) => mapDbError(db.updateMembershipCard(uid, data)),
      getMembershipByNumber: (num) => mapDbError(db.getMembershipByNumber(num)),
      getNextMembershipNumber: (year) => mapDbError(db.getNextMembershipNumber(year)),
      getStats: () => mapDbError(db.getStats()),
      updateStats: (stats) => mapDbError(db.updateStats(stats)),
      logAuditEntry: (uid, action, details) => mapDbError(db.logAuditEntry(uid, action, details)),
      getMemberAuditLog: (uid) => mapDbError(db.getMemberAuditLog(uid)),
      getAllUsers: () => mapDbError(db.getAllUsers()),
      softDeleteMember: (uid, deletedBy, reason) =>
        mapDbError(db.softDeleteMember(uid, deletedBy, reason)),
    });
  }),
);

// Composed layer: DatabaseServiceLive → FirestoreFromDatabaseLayer
const FirestoreServiceLive = FirestoreFromDatabaseLayer.pipe(Layer.provide(DatabaseServiceLive));

// Base services layer (no dependencies)
const BaseServicesLayer = Layer.mergeAll(
  StripeServiceLive,
  FirestoreServiceLive,
  DatabaseServiceLive,
  AuthServiceLive,
  WebhookIdempotencyServiceLive,
  QRServiceLive,
);

// Membership service (depends on Stripe + Firestore)
const MembershipLayer = MembershipServiceLive.pipe(
  Layer.provide(StripeServiceLive),
  Layer.provide(FirestoreServiceLive),
);

// Portal service (depends on Auth + Stripe + Firestore)
const PortalLayer = PortalServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(StripeServiceLive),
  Layer.provide(FirestoreServiceLive),
);

// Card service (depends on Firestore + QR only - no storage needed)
const CardLayer = MembershipCardServiceLive.pipe(
  Layer.provide(FirestoreServiceLive),
  Layer.provide(QRServiceLive),
);

// Stats service (depends on Firestore)
const StatsLayer = StatsServiceLive.pipe(Layer.provide(FirestoreServiceLive));

// Export service (depends on Firestore)
const ExportLayer = ExportServiceLive.pipe(Layer.provide(FirestoreServiceLive));

// Admin service (depends on Auth + Firestore + Stats + Stripe + Card)
const AdminLayer = AdminServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(FirestoreServiceLive),
  Layer.provide(StatsLayer),
  Layer.provide(StripeServiceLive),
  Layer.provide(CardLayer),
);

// Complete live layer with all services
export const LiveLayer = Layer.mergeAll(
  BaseServicesLayer,
  MembershipLayer,
  PortalLayer,
  CardLayer,
  StatsLayer,
  ExportLayer,
  AdminLayer,
);

// Re-export individual layers for selective use
export {
  BaseServicesLayer,
  MembershipLayer,
  PortalLayer,
  CardLayer,
  StatsLayer,
  ExportLayer,
  AdminLayer,
};

import {Layer} from 'effect';

import {AdminServiceLive} from './admin.service';
import {AuthServiceLive} from './auth.service';
import {MembershipCardServiceLive} from './card.service';
import {ExportServiceLive} from './export.service';
import {FirestoreServiceLive} from './firestore.service';
import {MembershipServiceLive} from './membership.service';
import {PortalServiceLive} from './portal.service';
import {QRServiceLive} from './qr.service';
import {StatsServiceLive} from './stats.service';
import {StripeServiceLive} from './stripe.service';
import {WebhookIdempotencyServiceLive} from './webhook-idempotency.service';

// Base services layer (no dependencies)
const BaseServicesLayer = Layer.mergeAll(
  StripeServiceLive,
  FirestoreServiceLive,
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

// Admin service (depends on Auth + Firestore + Stats)
const AdminLayer = AdminServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(FirestoreServiceLive),
  Layer.provide(StatsLayer),
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

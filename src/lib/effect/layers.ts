import {Layer} from 'effect';

import {AdminServiceLive} from './admin.service';
import {AuthServiceLive} from './auth.service';
import {MembershipCardServiceLive} from './card.service';
import {DatabaseServiceLive} from './database.service';
import {ExportServiceLive} from './export.service';
import {MembershipServiceLive} from './membership.service';
import {PortalServiceLive} from './portal.service';
import {QRServiceLive} from './qr.service';
import {StatsServiceLive} from './stats.service';
import {StripeServiceLive} from './stripe.service';
import {WebhookIdempotencyServiceLive} from './webhook-idempotency.service';

// Base services layer (no inter-service dependencies)
const BaseServicesLayer = Layer.mergeAll(
  StripeServiceLive,
  DatabaseServiceLive,
  AuthServiceLive,
  WebhookIdempotencyServiceLive,
  QRServiceLive,
);

// Membership service (depends on Stripe + Database)
const MembershipLayer = MembershipServiceLive.pipe(
  Layer.provide(StripeServiceLive),
  Layer.provide(DatabaseServiceLive),
);

// Portal service (depends on Auth + Stripe + Database)
const PortalLayer = PortalServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(StripeServiceLive),
  Layer.provide(DatabaseServiceLive),
);

// Card service (depends on Database + QR)
const CardLayer = MembershipCardServiceLive.pipe(
  Layer.provide(DatabaseServiceLive),
  Layer.provide(QRServiceLive),
);

// Stats service (depends on Database)
const StatsLayer = StatsServiceLive.pipe(Layer.provide(DatabaseServiceLive));

// Export service (depends on Database)
const ExportLayer = ExportServiceLive.pipe(Layer.provide(DatabaseServiceLive));

// Admin service (depends on Auth + Database + Stats + Stripe + Card)
const AdminLayer = AdminServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(DatabaseServiceLive),
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

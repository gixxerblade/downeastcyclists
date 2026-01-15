import { Layer } from "effect";
import { StripeServiceLive } from "./stripe.service";
import { FirestoreServiceLive } from "./firestore.service";
import { MembershipServiceLive } from "./membership.service";

// Base services layer
const BaseServicesLayer = Layer.merge(StripeServiceLive, FirestoreServiceLive);

// Membership service with its dependencies
const MembershipLayer = MembershipServiceLive.pipe(
  Layer.provide(BaseServicesLayer)
);

// Compose all live layers - exposes MembershipService, StripeService, and FirestoreService
// Layer.provide handles the dependency injection
export const LiveLayer = Layer.merge(MembershipLayer, BaseServicesLayer);

import { Context, Effect, Layer } from "effect";
import { FirestoreService } from "./firestore.service";
import { QRService } from "./qr.service";
import { CardError, FirestoreError, NotFoundError, QRError } from "./errors";
import type {
  MembershipCard,
  VerificationResult,
  MembershipDocument,
  UserDocument,
} from "./schemas";

// Service interface
export interface MembershipCardService {
  readonly createCard: (params: {
    userId: string;
    user: UserDocument;
    membership: MembershipDocument;
  }) => Effect.Effect<MembershipCard, CardError | FirestoreError | QRError>;

  readonly getCard: (userId: string) => Effect.Effect<MembershipCard | null, FirestoreError>;

  readonly verifyMembership: (
    membershipNumber: string,
  ) => Effect.Effect<VerificationResult, FirestoreError | NotFoundError>;

  readonly verifyQRCode: (
    qrData: string,
  ) => Effect.Effect<VerificationResult, QRError | FirestoreError | NotFoundError>;
}

// Service tag
export const MembershipCardService =
  Context.GenericTag<MembershipCardService>("MembershipCardService");

// Implementation
const make = Effect.gen(function* () {
  const firestore = yield* FirestoreService;
  const qr = yield* QRService;

  return MembershipCardService.of({
    // Create a new membership card - Effect.gen for complex orchestration
    createCard: ({ userId, user, membership }) =>
      Effect.gen(function* () {
        // Get current year
        const currentYear = new Date().getFullYear();

        // Generate unique membership number (atomic)
        const membershipNumber = yield* firestore.getNextMembershipNumber(currentYear);

        // Calculate validity dates
        const validFrom =
          membership.startDate.toDate?.()?.toISOString() ||
          new Date(membership.startDate as unknown as number).toISOString();
        const validUntil =
          membership.endDate.toDate?.() || new Date(membership.endDate as unknown as number);

        // Generate QR code data
        const qrData = yield* qr.generateQRData({
          membershipNumber,
          userId,
          validUntil,
        });

        // Create card document
        const card: Omit<MembershipCard, "id"> = {
          userId,
          membershipNumber,
          memberName: user.name || user.email,
          email: user.email,
          planType: membership.planType,
          status: membership.status,
          validFrom,
          validUntil: validUntil.toISOString(),
          qrCodeData: qrData,
          pdfUrl: null, // Not using PDFs - generate on-demand if needed later
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save to Firestore
        yield* firestore.setMembershipCard(userId, card);

        yield* Effect.log(`Membership card created: ${membershipNumber} for user ${userId}`);

        return { ...card, id: "current" } as MembershipCard;
      }),

    // Get existing card - simple delegation
    getCard: (userId) => firestore.getMembershipCard(userId),

    // Verify membership by number - for admin lookup
    verifyMembership: (membershipNumber) =>
      Effect.gen(function* () {
        const result = yield* firestore.getMembershipByNumber(membershipNumber);

        if (!result) {
          return yield* Effect.fail(
            new NotFoundError({ resource: "membership", id: membershipNumber }),
          );
        }

        const { card } = result;
        const expiresAt = new Date(card.validUntil);
        const now = new Date();
        const daysRemaining = Math.max(
          0,
          Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );

        const isActive = card.status === "active" || card.status === "trialing";
        const isExpired = expiresAt < now;

        let message: string;
        if (!isActive) {
          message = `Membership is ${card.status}`;
        } else if (isExpired) {
          message = "Membership has expired";
        } else if (daysRemaining <= 30) {
          message = `Valid - expires in ${daysRemaining} days`;
        } else {
          message = "Valid membership";
        }

        return {
          valid: isActive && !isExpired,
          membershipNumber: card.membershipNumber,
          memberName: card.memberName,
          planType: card.planType,
          status: card.status,
          expiresAt: card.validUntil,
          daysRemaining,
          message,
        };
      }),

    // Verify via QR code scan
    verifyQRCode: (qrData) =>
      Effect.gen(function* () {
        // Parse and verify QR signature
        const payload = yield* qr.verifyQRData(qrData);

        if (!payload.verified) {
          return {
            valid: false,
            membershipNumber: payload.mn,
            memberName: "Unknown",
            planType: "individual" as const,
            status: "canceled" as const,
            expiresAt: "",
            daysRemaining: 0,
            message: "Invalid QR code signature",
          };
        }

        // Look up full membership details
        const result = yield* firestore.getMembershipByNumber(payload.mn);

        if (!result) {
          return {
            valid: false,
            membershipNumber: payload.mn,
            memberName: "Unknown",
            planType: "individual" as const,
            status: "canceled" as const,
            expiresAt: "",
            daysRemaining: 0,
            message: "Membership not found",
          };
        }

        const { card } = result;
        const expiresAt = new Date(card.validUntil);
        const now = new Date();
        const daysRemaining = Math.max(
          0,
          Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );

        const isActive = card.status === "active" || card.status === "trialing";
        const isExpired = expiresAt < now;

        return {
          valid: isActive && !isExpired,
          membershipNumber: card.membershipNumber,
          memberName: card.memberName,
          planType: card.planType,
          status: card.status,
          expiresAt: card.validUntil,
          daysRemaining,
          message: isActive && !isExpired ? "Valid membership" : "Invalid or expired",
        };
      }),
  });
});

// Live layer
export const MembershipCardServiceLive = Layer.effect(MembershipCardService, make);

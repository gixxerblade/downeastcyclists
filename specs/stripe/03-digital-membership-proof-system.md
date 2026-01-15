# Plan: Digital Membership Proof System - Phase 3 (Effect-TS Refactored)

## Task Description

Implement a digital membership proof system for Down East Cyclists that generates unique membership numbers, creates digital membership cards with QR codes, and provides admin verification capabilities — all orchestrated with **Effect-TS** for type-safe data flow, error handling, and service composition.

## Objective

Deliver a complete digital membership proof system that enables:

- Automatic generation of unique, formatted membership numbers upon subscription activation
- Digital membership cards displayed in the member portal with QR codes
- PDF membership card generation stored in Firebase Cloud Storage
- Admin QR code scanning to instantly verify membership status at events
- Persistent storage of membership card metadata in Firestore

**Effect-TS Integration Goals:**

- MembershipCardService handles card generation, storage, and retrieval
- QRService wraps QR code generation with proper error handling
- StorageService manages Cloud Storage operations
- Webhook pipeline automatically generates cards on subscription activation
- Effect Schema validates all card data at boundaries

## Problem Statement

With Phase 1 (Stripe subscriptions) and Phase 2 (member portal) complete, members have no way to prove their membership at club events, rides, or partner bike shops. The current system lacks:

1. Unique membership identifiers for tracking and reference
2. Visual proof of membership that can be shown on mobile devices
3. Verifiable credentials that event staff can validate
4. Printable/downloadable membership cards for offline use

## Solution Approach

1. **Membership Number Generation**: Create a deterministic yet unique numbering system using year prefix + sequential counter stored in Firestore
2. **QR Code Integration**: Encode membership verification data into QR codes using Effect-wrapped utilities
3. **Digital Card Component**: Build a responsive membership card component that displays member info, status, and QR code
4. **PDF Generation**: Use server-side PDF generation with Cloud Storage for downloadable cards
5. **Admin Verification**: Create a dedicated admin endpoint for QR code scanning and instant verification

## Effect-TS Layer Architecture (Phase 3 Extension)

```text
┌─────────────────────────────────────────────────────────────────┐
│                 Digital Membership Proof System                 │
│           Member Portal + Admin Verification Scanner            │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MembershipCardService                         │
│    (Business logic for card generation and verification)        │
│    - generateMembershipNumber                                   │
│    - createDigitalCard                                          │
│    - generatePDF                                                │
│    - verifyMembership                                           │
└─────────────────────────────────────────────────────────────────┘
           │                │                       │
           ▼                ▼                       ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
│  QRService  │   │  StorageService │   │    FirestoreService     │
│(QR encoding)│   │ (Cloud Storage) │   │    (from Phase 1)       │
└─────────────┘   └─────────────────┘   └─────────────────────────┘
```

## Relevant Files

### Existing Files (from Phase 1 & 2)

- `src/lib/effect/firestore.service.ts` - FirestoreService
- `src/lib/effect/membership.service.ts` - MembershipService
- `src/lib/effect/errors.ts` - Tagged error types (extend with CardError)
- `src/lib/effect/schemas.ts` - Effect Schema definitions (extend)
- `src/lib/effect/layers.ts` - Layer composition
- `app/api/webhooks/stripe/route.ts` - Webhook handler (extend)
- `app/member/page.tsx` - Member dashboard (integrate card)

### New Files to Create

#### Effect Services

- `src/lib/effect/qr.service.ts` - QRService (QR code generation)
- `src/lib/effect/storage.service.ts` - StorageService (Cloud Storage)
- `src/lib/effect/card.service.ts` - MembershipCardService (business logic)

#### API Routes

- `app/api/membership/card/route.ts` - Get digital card data
- `app/api/membership/card/pdf/route.ts` - Generate PDF card
- `app/api/admin/verify/[membershipNumber]/route.ts` - Admin verification

#### UI Components

- `src/components/member/DigitalCard.tsx` - Digital membership card component
- `src/components/member/QRCode.tsx` - QR code display component
- `src/components/admin/VerificationScanner.tsx` - Admin QR scanner

## Step by Step Tasks

### 1. Install Additional Dependencies

```bash
pnpm add qrcode @react-pdf/renderer @google-cloud/storage
pnpm add -D @types/qrcode
```

### 2. Add Card-Related Errors

Update `src/lib/effect/errors.ts`:

```typescript
// Add to existing errors file

export class CardError extends Data.TaggedError("CardError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class QRError extends Data.TaggedError("QRError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

// Update union type
export type AppError =
  | StripeError
  | FirestoreError
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | AuthError
  | SessionError
  | CardError
  | StorageError
  | QRError;
```

### 3. Add Card-Related Schemas

Update `src/lib/effect/schemas.ts`:

```typescript
// Add to existing schemas file

// Membership card schema
export const MembershipCard = S.Struct({
  id: S.String,
  userId: S.String,
  membershipNumber: S.String, // Format: DEC-2025-000001
  memberName: S.String,
  email: S.String,
  planType: PlanType,
  status: MembershipStatus,
  validFrom: S.String, // ISO date
  validUntil: S.String, // ISO date
  qrCodeData: S.String, // Encoded verification data
  pdfUrl: S.NullOr(S.String), // Cloud Storage URL
  createdAt: S.String,
  updatedAt: S.String,
});
export type MembershipCard = S.Schema.Type<typeof MembershipCard>;

// QR code payload (what's encoded in the QR)
export const QRPayload = S.Struct({
  mn: S.String, // membership number
  u: S.String, // user ID (truncated)
  v: S.String, // valid until (compact date)
  s: S.String, // signature hash
});
export type QRPayload = S.Schema.Type<typeof QRPayload>;

// Verification result
export const VerificationResult = S.Struct({
  valid: S.Boolean,
  membershipNumber: S.String,
  memberName: S.String,
  planType: PlanType,
  status: MembershipStatus,
  expiresAt: S.String,
  daysRemaining: S.Number,
  message: S.String,
});
export type VerificationResult = S.Schema.Type<typeof VerificationResult>;

// Counter document for membership numbers
export const MembershipCounter = S.Struct({
  year: S.Number,
  lastNumber: S.Number,
  updatedAt: S.Any,
});
export type MembershipCounter = S.Schema.Type<typeof MembershipCounter>;
```

### 4. Create QRService

Create `src/lib/effect/qr.service.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import QRCode from "qrcode";
import crypto from "crypto";
import { QRError } from "./errors";
import type { QRPayload } from "./schemas";

// Service interface
export interface QRService {
  readonly generateQRData: (payload: {
    membershipNumber: string;
    userId: string;
    validUntil: Date;
  }) => Effect.Effect<string, QRError>;

  readonly generateQRImage: (
    data: string,
    options?: { width?: number; margin?: number }
  ) => Effect.Effect<string, QRError>; // Returns data URL

  readonly verifyQRData: (
    data: string
  ) => Effect.Effect<QRPayload & { verified: boolean }, QRError>;
}

// Service tag
export const QRService = Context.GenericTag<QRService>("QRService");

// Secret for signing (should be in env)
const getSigningSecret = () =>
  process.env.QR_SIGNING_SECRET || "dec-membership-secret-2025";

// Implementation
const make = Effect.sync(() => {
  const secret = getSigningSecret();

  return QRService.of({
    // Generate compact QR payload with signature
    generateQRData: ({ membershipNumber, userId, validUntil }) =>
      Effect.try({
        try: () => {
          // Create compact date (YYYYMMDD)
          const compactDate = validUntil.toISOString().slice(0, 10).replace(/-/g, "");

          // Create signature
          const dataToSign = `${membershipNumber}:${userId.slice(0, 8)}:${compactDate}`;
          const signature = crypto
            .createHmac("sha256", secret)
            .update(dataToSign)
            .digest("hex")
            .slice(0, 8); // Truncate for compact QR

          const payload: QRPayload = {
            mn: membershipNumber,
            u: userId.slice(0, 8),
            v: compactDate,
            s: signature,
          };

          return JSON.stringify(payload);
        },
        catch: (error) =>
          new QRError({
            code: "QR_DATA_GENERATION_FAILED",
            message: "Failed to generate QR data",
            cause: error,
          }),
      }),

    // Generate QR code image as data URL
    generateQRImage: (data, options = {}) =>
      Effect.tryPromise({
        try: () =>
          QRCode.toDataURL(data, {
            width: options.width || 200,
            margin: options.margin || 2,
            errorCorrectionLevel: "M",
          }),
        catch: (error) =>
          new QRError({
            code: "QR_IMAGE_GENERATION_FAILED",
            message: "Failed to generate QR code image",
            cause: error,
          }),
      }),

    // Verify QR data and signature
    verifyQRData: (data) =>
      Effect.try({
        try: () => {
          const payload = JSON.parse(data) as QRPayload;

          // Recreate signature to verify
          const dataToSign = `${payload.mn}:${payload.u}:${payload.v}`;
          const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(dataToSign)
            .digest("hex")
            .slice(0, 8);

          return {
            ...payload,
            verified: payload.s === expectedSignature,
          };
        },
        catch: (error) =>
          new QRError({
            code: "QR_VERIFICATION_FAILED",
            message: "Failed to verify QR data",
            cause: error,
          }),
      }),
  });
});

// Live layer
export const QRServiceLive = Layer.effect(QRService, make);
```

### 5. Create StorageService

Create `src/lib/effect/storage.service.ts`:

```typescript
import { Context, Effect, Layer } from "effect";
import { Storage, Bucket } from "@google-cloud/storage";
import { StorageError } from "./errors";

// Service interface
export interface StorageService {
  readonly uploadBuffer: (
    path: string,
    buffer: Buffer,
    contentType: string
  ) => Effect.Effect<string, StorageError>; // Returns public URL

  readonly getSignedUrl: (
    path: string,
    expiresInMinutes?: number
  ) => Effect.Effect<string, StorageError>;

  readonly deleteFile: (path: string) => Effect.Effect<void, StorageError>;
}

// Service tag
export const StorageService = Context.GenericTag<StorageService>("StorageService");

// Implementation
const make = Effect.gen(function* () {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    return yield* Effect.fail(
      new StorageError({
        code: "MISSING_CONFIG",
        message: "FIREBASE_STORAGE_BUCKET not configured",
      })
    );
  }

  const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
    },
  });

  const bucket = storage.bucket(bucketName);

  return StorageService.of({
    uploadBuffer: (path, buffer, contentType) =>
      Effect.tryPromise({
        try: async () => {
          const file = bucket.file(path);
          await file.save(buffer, {
            contentType,
            metadata: {
              cacheControl: "public, max-age=31536000",
            },
          });

          // Make file public
          await file.makePublic();

          return `https://storage.googleapis.com/${bucketName}/${path}`;
        },
        catch: (error) =>
          new StorageError({
            code: "UPLOAD_FAILED",
            message: `Failed to upload file to ${path}`,
            cause: error,
          }),
      }),

    getSignedUrl: (path, expiresInMinutes = 60) =>
      Effect.tryPromise({
        try: async () => {
          const file = bucket.file(path);
          const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + expiresInMinutes * 60 * 1000,
          });
          return url;
        },
        catch: (error) =>
          new StorageError({
            code: "SIGNED_URL_FAILED",
            message: `Failed to get signed URL for ${path}`,
            cause: error,
          }),
      }),

    deleteFile: (path) =>
      Effect.tryPromise({
        try: () => bucket.file(path).delete(),
        catch: (error) =>
          new StorageError({
            code: "DELETE_FAILED",
            message: `Failed to delete file ${path}`,
            cause: error,
          }),
      }),
  });
});

// Live layer
export const StorageServiceLive = Layer.effect(StorageService, make);
```

### 6. Extend FirestoreService for Cards

Update `src/lib/effect/firestore.service.ts` - add card-related methods:

```typescript
// Add to FirestoreService interface
readonly getNextMembershipNumber: (
  year: number
) => Effect.Effect<string, FirestoreError>;

readonly getMembershipCard: (
  userId: string
) => Effect.Effect<MembershipCard | null, FirestoreError>;

readonly setMembershipCard: (
  userId: string,
  card: Omit<MembershipCard, "id">
) => Effect.Effect<void, FirestoreError>;

readonly getMembershipByNumber: (
  membershipNumber: string
) => Effect.Effect<{ userId: string; card: MembershipCard } | null, FirestoreError>;

// Add to implementation
getNextMembershipNumber: (year) =>
  Effect.gen(function* () {
    const counterRef = db.collection("counters").doc(`membership_${year}`);

    // Use transaction for atomic increment
    const newNumber = yield* Effect.tryPromise({
      try: () =>
        db.runTransaction(async (transaction) => {
          const counterDoc = await transaction.get(counterRef);

          let nextNumber: number;
          if (!counterDoc.exists) {
            nextNumber = 1;
            transaction.set(counterRef, {
              year,
              lastNumber: 1,
              updatedAt: FieldValue.serverTimestamp(),
            });
          } else {
            const data = counterDoc.data()!;
            nextNumber = (data.lastNumber || 0) + 1;
            transaction.update(counterRef, {
              lastNumber: nextNumber,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          return nextNumber;
        }),
      catch: (error) =>
        new FirestoreError({
          code: "COUNTER_INCREMENT_FAILED",
          message: "Failed to get next membership number",
          cause: error,
        }),
    });

    // Format: DEC-2025-000001
    return `DEC-${year}-${String(newNumber).padStart(6, "0")}`;
  }),

getMembershipCard: (userId) =>
  Effect.tryPromise({
    try: async () => {
      const doc = await db
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection("cards")
        .doc("current")
        .get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as MembershipCard;
    },
    catch: (error) =>
      new FirestoreError({
        code: "GET_CARD_FAILED",
        message: `Failed to get membership card for user ${userId}`,
        cause: error,
      }),
  }),

setMembershipCard: (userId, card) =>
  Effect.tryPromise({
    try: () =>
      db
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection("cards")
        .doc("current")
        .set({
          ...card,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
    catch: (error) =>
      new FirestoreError({
        code: "SET_CARD_FAILED",
        message: `Failed to set membership card for user ${userId}`,
        cause: error,
      }),
  }),

getMembershipByNumber: (membershipNumber) =>
  Effect.tryPromise({
    try: async () => {
      // Collection group query across all users' cards
      const snapshot = await db
        .collectionGroup("cards")
        .where("membershipNumber", "==", membershipNumber)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const card = { id: doc.id, ...doc.data() } as MembershipCard;

      // Extract userId from path: users/{userId}/cards/current
      const userId = doc.ref.parent.parent!.id;

      return { userId, card };
    },
    catch: (error) =>
      new FirestoreError({
        code: "GET_BY_NUMBER_FAILED",
        message: `Failed to get membership by number ${membershipNumber}`,
        cause: error,
      }),
  }),
```

### 7. Create MembershipCardService

Create `src/lib/effect/card.service.ts`:

```typescript
import { Context, Effect, Layer, pipe } from "effect";
import { FirestoreService } from "./firestore.service";
import { QRService } from "./qr.service";
import { StorageService } from "./storage.service";
import {
  CardError,
  FirestoreError,
  NotFoundError,
  QRError,
  StorageError,
} from "./errors";
import type { MembershipCard, VerificationResult, MembershipDocument, UserDocument } from "./schemas";

// Service interface
export interface MembershipCardService {
  readonly createCard: (params: {
    userId: string;
    user: UserDocument;
    membership: MembershipDocument;
  }) => Effect.Effect<
    MembershipCard,
    CardError | FirestoreError | QRError
  >;

  readonly getCard: (
    userId: string
  ) => Effect.Effect<MembershipCard | null, FirestoreError>;

  readonly generatePDF: (
    userId: string
  ) => Effect.Effect<string, CardError | StorageError | NotFoundError>;

  readonly verifyMembership: (
    membershipNumber: string
  ) => Effect.Effect<VerificationResult, FirestoreError | NotFoundError>;

  readonly verifyQRCode: (
    qrData: string
  ) => Effect.Effect<VerificationResult, QRError | FirestoreError | NotFoundError>;
}

// Service tag
export const MembershipCardService =
  Context.GenericTag<MembershipCardService>("MembershipCardService");

// Implementation
const make = Effect.gen(function* () {
  const firestore = yield* FirestoreService;
  const qr = yield* QRService;
  const storage = yield* StorageService;

  return MembershipCardService.of({
    // Create a new membership card - Effect.gen for complex orchestration
    createCard: ({ userId, user, membership }) =>
      Effect.gen(function* () {
        // Get current year
        const currentYear = new Date().getFullYear();

        // Generate unique membership number (atomic)
        const membershipNumber = yield* firestore.getNextMembershipNumber(currentYear);

        // Calculate validity dates
        const validFrom = membership.startDate.toDate?.()?.toISOString() ||
          new Date(membership.startDate as any).toISOString();
        const validUntil = membership.endDate.toDate?.() ||
          new Date(membership.endDate as any);

        // Generate QR code data
        const qrData = yield* qr.generateQRData({
          membershipNumber,
          userId,
          validUntil,
        });

        // Generate QR code image (data URL)
        const qrCodeImage = yield* qr.generateQRImage(qrData);

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
          pdfUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save to Firestore
        yield* firestore.setMembershipCard(userId, card);

        yield* Effect.log(
          `Membership card created: ${membershipNumber} for user ${userId}`
        );

        return { ...card, id: "current" } as MembershipCard;
      }),

    // Get existing card - simple delegation
    getCard: (userId) => firestore.getMembershipCard(userId),

    // Generate PDF and upload to storage
    generatePDF: (userId) =>
      Effect.gen(function* () {
        // Get card data
        const card = yield* firestore.getMembershipCard(userId);

        if (!card) {
          return yield* Effect.fail(
            new NotFoundError({ resource: "membershipCard", id: userId })
          );
        }

        // Generate PDF buffer (simplified - in real impl use @react-pdf/renderer)
        const pdfBuffer = yield* Effect.try({
          try: () => {
            // Placeholder for PDF generation logic
            // In real implementation, use @react-pdf/renderer
            return Buffer.from(`Membership Card: ${card.membershipNumber}`);
          },
          catch: (error) =>
            new CardError({
              code: "PDF_GENERATION_FAILED",
              message: "Failed to generate PDF",
              cause: error,
            }),
        });

        // Upload to Cloud Storage
        const path = `membership-cards/${userId}/${card.membershipNumber}.pdf`;
        const pdfUrl = yield* storage.uploadBuffer(pdfBuffer, path, "application/pdf");

        // Update card with PDF URL
        yield* firestore.setMembershipCard(userId, {
          ...card,
          pdfUrl,
          updatedAt: new Date().toISOString(),
        });

        return pdfUrl;
      }),

    // Verify membership by number - for admin lookup
    verifyMembership: (membershipNumber) =>
      Effect.gen(function* () {
        const result = yield* firestore.getMembershipByNumber(membershipNumber);

        if (!result) {
          return yield* Effect.fail(
            new NotFoundError({ resource: "membership", id: membershipNumber })
          );
        }

        const { card } = result;
        const expiresAt = new Date(card.validUntil);
        const now = new Date();
        const daysRemaining = Math.max(
          0,
          Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        const isActive =
          card.status === "active" || card.status === "trialing";
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
          Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        const isActive =
          card.status === "active" || card.status === "trialing";
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
export const MembershipCardServiceLive = Layer.effect(
  MembershipCardService,
  make
);
```

### 8. Update Layer Composition

Update `src/lib/effect/layers.ts`:

```typescript
import { Layer } from "effect";
// ... existing imports
import { QRService, QRServiceLive } from "./qr.service";
import { StorageService, StorageServiceLive } from "./storage.service";
import { MembershipCardService, MembershipCardServiceLive } from "./card.service";

// Base services layer (no dependencies)
const BaseServicesLayer = Layer.mergeAll(
  StripeServiceLive,
  FirestoreServiceLive,
  AuthServiceLive,
  QRServiceLive,
  StorageServiceLive
);

// Card service (depends on Firestore + QR + Storage)
const CardLayer = MembershipCardServiceLive.pipe(
  Layer.provide(FirestoreServiceLive),
  Layer.provide(QRServiceLive),
  Layer.provide(StorageServiceLive)
);

// Complete live layer with all services
export const LiveLayer = Layer.mergeAll(
  BaseServicesLayer,
  MembershipLayer,
  PortalLayer,
  CardLayer
);

// Re-export for selective use
export { CardLayer };
```

### 9. Create Card API Route

Create `app/api/membership/card/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { PortalService } from "@/src/lib/effect/portal.service";
import { MembershipCardService } from "@/src/lib/effect/card.service";
import { FirestoreService } from "@/src/lib/effect/firestore.service";
import { LiveLayer } from "@/src/lib/effect/layers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const cardService = yield* MembershipCardService;

      // Verify session
      const session = yield* portal.verifySession(sessionCookie);

      // Get existing card
      const card = yield* cardService.getCard(session.uid);

      if (!card) {
        return { hasCard: false, card: null };
      }

      return { hasCard: true, card };
    }),

    Effect.catchTag("SessionError", () =>
      Effect.succeed({ error: "Session expired", _tag: "error" as const, status: 401 })
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 })
    )
  );

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
```

### 10. Create Admin Verification Route

Create `app/api/admin/verify/[membershipNumber]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { PortalService } from "@/src/lib/effect/portal.service";
import { MembershipCardService } from "@/src/lib/effect/card.service";
import { LiveLayer } from "@/src/lib/effect/layers";

interface RouteParams {
  params: Promise<{ membershipNumber: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { membershipNumber } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const portal = yield* PortalService;
      const cardService = yield* MembershipCardService;

      // Verify admin session (add admin check here)
      const session = yield* portal.verifySession(sessionCookie);

      // TODO: Add admin role verification
      // if (!session.isAdmin) return yield* Effect.fail(...)

      // Verify membership
      return yield* cardService.verifyMembership(membershipNumber);
    }),

    Effect.catchTag("SessionError", () =>
      Effect.succeed({ error: "Session expired", _tag: "error" as const, status: 401 })
    ),
    Effect.catchTag("NotFoundError", (error) =>
      Effect.succeed({
        valid: false,
        membershipNumber,
        message: "Membership not found",
        _tag: "result" as const,
      })
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 })
    )
  );

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
```

### 11. Extend Webhook to Generate Cards

Update `app/api/webhooks/stripe/route.ts` - add card generation:

```typescript
// In the checkout.session.completed handler, after creating membership:
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  yield* membershipService.processCheckoutCompleted(session);

  // Generate membership card
  yield* Effect.gen(function* () {
    const cardService = yield* MembershipCardService;
    const firestore = yield* FirestoreService;

    // Get user and membership data
    const userId = session.metadata?.userId || subscriptionId;
    const user = yield* firestore.getUser(userId);
    const membership = yield* firestore.getActiveMembership(userId);

    if (user && membership) {
      yield* cardService.createCard({ userId, user, membership });
    }
  });
  break;
}
```

### 12. Create Digital Card Component

Create `src/components/member/DigitalCard.tsx`:

```typescript
"use client";

import { Box, Card, CardContent, Typography, Chip, Button } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import type { MembershipCard } from "@/lib/effect/schemas";

interface DigitalCardProps {
  card: MembershipCard;
  onDownloadPDF?: () => void;
}

const statusColors: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  canceled: "error",
};

export function DigitalCard({ card, onDownloadPDF }: DigitalCardProps) {
  return (
    <Card
      sx={{
        background: "linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)",
        color: "white",
        maxWidth: 400,
      }}
    >
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Down East Cyclists
          </Typography>
          <Chip
            label={card.status}
            color={statusColors[card.status] || "default"}
            size="small"
          />
        </Box>

        {/* Member Info */}
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Member
        </Typography>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {card.memberName}
        </Typography>

        {/* Membership Number */}
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Membership #
        </Typography>
        <Typography variant="h6" fontFamily="monospace" gutterBottom>
          {card.membershipNumber}
        </Typography>

        {/* Plan & Validity */}
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Plan
            </Typography>
            <Typography variant="body1">
              {card.planType === "family" ? "Family" : "Individual"}
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Valid Until
            </Typography>
            <Typography variant="body1">
              {new Date(card.validUntil).toLocaleDateString()}
            </Typography>
          </Box>
        </Box>

        {/* QR Code */}
        <Box
          display="flex"
          justifyContent="center"
          bgcolor="white"
          borderRadius={2}
          p={2}
          mb={2}
        >
          <QRCodeSVG
            value={card.qrCodeData}
            size={150}
            level="M"
            includeMargin={false}
          />
        </Box>

        {/* Download Button */}
        {onDownloadPDF && (
          <Button
            fullWidth
            variant="outlined"
            sx={{ color: "white", borderColor: "white" }}
            onClick={onDownloadPDF}
          >
            Download PDF Card
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### 13. Create QR Scanner Component

Create `src/components/admin/VerificationScanner.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Box, Typography, Alert, Card, CardContent, Button } from "@mui/material";
import { Html5QrcodeScanner } from "html5-qrcode";
import type { VerificationResult } from "@/lib/effect/schemas";

interface VerificationScannerProps {
  onVerificationResult?: (result: VerificationResult) => void;
}

export function VerificationScanner({ onVerificationResult }: VerificationScannerProps) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      async (decodedText) => {
        // Stop scanning
        scanner.clear();
        setScanning(false);

        try {
          // Send to verification endpoint
          const response = await fetch("/api/admin/verify/qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrData: decodedText }),
          });

          const verificationResult = await response.json();
          setResult(verificationResult);
          onVerificationResult?.(verificationResult);
        } catch (err) {
          setError("Failed to verify membership");
        }
      },
      (errorMessage) => {
        // Ignore scan errors (continuous scanning)
      }
    );

    return () => {
      scanner.clear();
    };
  }, [scanning, onVerificationResult]);

  const handleRescan = () => {
    setResult(null);
    setError(null);
    setScanning(true);
  };

  if (result) {
    return (
      <Card>
        <CardContent>
          <Alert
            severity={result.valid ? "success" : "error"}
            sx={{ mb: 2 }}
          >
            {result.message}
          </Alert>

          <Typography variant="h6" gutterBottom>
            {result.memberName}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Membership #{result.membershipNumber}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {result.planType === "family" ? "Family" : "Individual"} Plan
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Expires: {new Date(result.expiresAt).toLocaleDateString()}
          </Typography>

          {result.daysRemaining > 0 && (
            <Typography variant="body2" color="text.secondary">
              {result.daysRemaining} days remaining
            </Typography>
          )}

          <Button
            variant="outlined"
            fullWidth
            onClick={handleRescan}
            sx={{ mt: 2 }}
          >
            Scan Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box id="qr-reader" sx={{ width: "100%", maxWidth: 400, mx: "auto" }} />

      <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
        Point camera at membership QR code
      </Typography>
    </Box>
  );
}
```

## Effect-TS Pattern Guide (Phase 3)

### When to Use Effect.pipe vs Effect.gen

| Scenario | Pattern | Example |
| --- | --- | --- |
| Simple QR generation | `Effect.pipe` | `generateQRImage` - single operation |
| Card creation flow | `Effect.gen` | Multiple dependent steps (number, QR, save) |
| Verification lookup | `Effect.gen` | Parse QR, lookup, calculate status |
| Storage upload | `Effect.pipe` | Linear transform chain |

### Atomic Operations Pattern

```typescript
// Use Firestore transactions for atomic membership number generation
const newNumber = yield* Effect.tryPromise({
  try: () =>
    db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      const nextNumber = (doc.data()?.lastNumber || 0) + 1;
      transaction.update(counterRef, { lastNumber: nextNumber });
      return nextNumber;
    }),
  catch: (error) => new FirestoreError({ ... })
});
```

### Service Composition

```typescript
// MembershipCardService composes multiple services
const make = Effect.gen(function* () {
  const firestore = yield* FirestoreService;
  const qr = yield* QRService;
  const storage = yield* StorageService;

  return MembershipCardService.of({ ... });
});
```

## Acceptance Criteria

- [ ] `QRService` implemented with generate/verify methods
- [ ] `StorageService` implemented for Cloud Storage operations
- [ ] `MembershipCardService` orchestrates card creation/verification
- [ ] Membership numbers follow format `DEC-YYYY-NNNNNN`
- [ ] QR codes contain signed, compact verification data
- [ ] Cards automatically generated on subscription activation
- [ ] PDF generation uploads to Cloud Storage
- [ ] Admin verification works via membership number lookup
- [ ] Admin QR scanner verifies signature and status
- [ ] All services use tagged errors (`CardError`, `QRError`, `StorageError`)
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)

## Validation Commands

```bash
# Install dependencies
pnpm add qrcode @react-pdf/renderer @google-cloud/storage html5-qrcode qrcode.react
pnpm add -D @types/qrcode

# Verify TypeScript compilation
pnpm tsc --noEmit

# Build Next.js
pnpm build

# Test card endpoint
curl http://localhost:3000/api/membership/card \
  -H "Cookie: session=..."

# Test admin verification
curl http://localhost:3000/api/admin/verify/DEC-2025-000001 \
  -H "Cookie: session=..."
```

## Environment Variables Required

```env
# Cloud Storage (add to existing)
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
QR_SIGNING_SECRET=your-secret-key-for-qr-signatures
```

## Notes

- Membership numbers are generated atomically using Firestore transactions
- QR codes use HMAC signatures for tamper detection
- PDF generation can be enhanced with @react-pdf/renderer
- Admin scanner requires camera permissions
- Cards subcollection allows efficient querying per user

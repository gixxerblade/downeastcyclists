# Plan: Admin Dashboard Membership Management - Phase 4 (Effect-TS Refactored)

## Task Description

Implement a comprehensive admin dashboard for Down East Cyclists that enables administrators to manage memberships, view analytics, and perform administrative operations — all orchestrated with **Effect-TS** for type-safe data flow, error handling, and service composition.

## Objective

Deliver a fully functional admin membership management system that enables:

- Secure admin role management via Firebase Auth custom claims
- Real-time dashboard displaying membership analytics (total members, active/expired counts, revenue)
- Advanced membership search and filtering (by status, plan type, expiration date)
- Manual adjustment of membership dates for exceptional circumstances
- CSV export of member data for external reporting
- Automated analytics counters maintained via Effect services

**Effect-TS Integration Goals:**

- AdminService wraps all admin operations with proper authorization
- StatsService handles analytics aggregation and caching
- ExportService manages CSV generation with streaming
- All admin operations use Effect.catchTag for granular error handling
- Effect Schema validates all admin request/response types

## Problem Statement

With Phases 1-3 complete, administrators lack the tools to:

1. Efficiently manage and oversee all club memberships
2. View aggregated analytics without expensive client-side computation
3. Make manual adjustments to membership records when needed
4. Export member data for mailings, event check-ins, or board reporting
5. Distinguish admin users from regular members securely

## Solution Approach

1. **Firebase Auth Custom Claims**: Replace email whitelist with custom claims (`{ admin: true }`)
2. **Effect-Based Analytics**: Maintain denormalized stats in Firestore, updated via services
3. **Collection Group Queries**: Query all memberships across users efficiently
4. **Server-Side Admin API**: Secure routes that verify admin claims before operations
5. **Streaming Export**: Use Effect streams for large CSV exports

## Effect-TS Layer Architecture (Phase 4 Extension)

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                             │
│          Analytics + Search + Management + Export                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AdminService                               │
│    (Authorization + Admin Operations)                            │
│    - verifyAdmin                                                 │
│    - setAdminClaim                                               │
│    - adjustMembership                                            │
└─────────────────────────────────────────────────────────────────┘
           │                │                       │
           ▼                ▼                       ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
│StatsService │   │  ExportService  │   │    FirestoreService     │
│(Analytics)  │   │ (CSV Export)    │   │    (from Phase 1)       │
└─────────────┘   └─────────────────┘   └─────────────────────────┘
```

## Relevant Files

### Existing Files (from Phase 1-3)

- `src/lib/effect/firestore.service.ts` - FirestoreService (extend)
- `src/lib/effect/auth.service.ts` - AuthService (extend for claims)
- `src/lib/effect/errors.ts` - Tagged error types (extend)
- `src/lib/effect/schemas.ts` - Effect Schema definitions (extend)
- `src/lib/effect/layers.ts` - Layer composition
- `app/api/webhooks/stripe/route.ts` - Webhook handler (extend for stats)
- `app/dashboard/page.tsx` - Existing admin dashboard (enhance)
- `middleware.ts` - Auth middleware (update for claims)

### New Files to Create

#### Effect Services

- `src/lib/effect/admin.service.ts` - AdminService (admin operations)
- `src/lib/effect/stats.service.ts` - StatsService (analytics)
- `src/lib/effect/export.service.ts` - ExportService (CSV generation)

#### API Routes

- `app/api/admin/stats/route.ts` - Get analytics data
- `app/api/admin/members/route.ts` - Search/list members
- `app/api/admin/members/[userId]/route.ts` - Get/update member
- `app/api/admin/export/route.ts` - Export CSV
- `app/api/admin/claims/route.ts` - Manage admin claims

#### UI Components

- `src/components/admin/StatsCards.tsx` - Analytics cards
- `src/components/admin/MemberTable.tsx` - Member list table
- `src/components/admin/MemberSearch.tsx` - Search/filter UI
- `src/components/admin/MemberEditDialog.tsx` - Edit member dialog
- `src/components/admin/ExportButton.tsx` - CSV export button

## Step by Step Tasks

### 1. Add Admin-Related Errors

Update `src/lib/effect/errors.ts`:

```typescript
// Add to existing errors file

export class AdminError extends Data.TaggedError("AdminError")<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ExportError extends Data.TaggedError("ExportError")<{
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
  | QRError
  | AdminError
  | ExportError;
```

### 2. Add Admin-Related Schemas

Update `src/lib/effect/schemas.ts`:

```typescript
// Add to existing schemas file

// Admin stats schema
export const MembershipStats = S.Struct({
  totalMembers: S.Number,
  activeMembers: S.Number,
  expiredMembers: S.Number,
  canceledMembers: S.Number,
  individualCount: S.Number,
  familyCount: S.Number,
  monthlyRevenue: S.Number,
  yearlyRevenue: S.Number,
  updatedAt: S.String,
});
export type MembershipStats = S.Schema.Type<typeof MembershipStats>;

// Member search params
export const MemberSearchParams = S.Struct({
  query: S.optional(S.String),
  status: S.optional(MembershipStatus),
  planType: S.optional(PlanType),
  expiringWithinDays: S.optional(S.Number),
  page: S.optional(S.Number),
  pageSize: S.optional(S.Number),
});
export type MemberSearchParams = S.Schema.Type<typeof MemberSearchParams>;

// Member with membership (joined data)
export const MemberWithMembership = S.Struct({
  user: UserDocument,
  membership: S.NullOr(MembershipDocument),
  card: S.NullOr(MembershipCard),
});
export type MemberWithMembership = S.Schema.Type<typeof MemberWithMembership>;

// Membership adjustment request
export const MembershipAdjustment = S.Struct({
  userId: S.String,
  membershipId: S.String,
  newEndDate: S.optional(S.String),
  newStatus: S.optional(MembershipStatus),
  reason: S.String,
});
export type MembershipAdjustment = S.Schema.Type<typeof MembershipAdjustment>;

// Admin claim management
export const AdminClaimRequest = S.Struct({
  uid: S.String,
  isAdmin: S.Boolean,
});
export type AdminClaimRequest = S.Schema.Type<typeof AdminClaimRequest>;

// Export options
export const ExportOptions = S.Struct({
  includeEmail: S.Boolean,
  includePhone: S.Boolean,
  includeAddress: S.Boolean,
  statusFilter: S.optional(MembershipStatus),
  format: S.Literal("csv", "json"),
});
export type ExportOptions = S.Schema.Type<typeof ExportOptions>;
```

### 3. Extend AuthService for Custom Claims

Update `src/lib/effect/auth.service.ts`:

```typescript
// Add to AuthService interface
readonly setCustomClaims: (
  uid: string,
  claims: { admin?: boolean }
) => Effect.Effect<void, AuthError>;

readonly getCustomClaims: (
  uid: string
) => Effect.Effect<{ admin?: boolean }, AuthError>;

readonly verifyAdminClaim: (
  sessionCookie: string
) => Effect.Effect<{ uid: string; email?: string; isAdmin: boolean }, AuthError | SessionError>;

// Add to implementation
setCustomClaims: (uid, claims) =>
  Effect.tryPromise({
    try: () => auth.setCustomUserClaims(uid, claims),
    catch: (error) =>
      new AuthError({
        code: "SET_CLAIMS_FAILED",
        message: `Failed to set custom claims for ${uid}`,
        cause: error,
      }),
  }),

getCustomClaims: (uid) =>
  Effect.tryPromise({
    try: async () => {
      const user = await auth.getUser(uid);
      return { admin: user.customClaims?.admin || false };
    },
    catch: (error) =>
      new AuthError({
        code: "GET_CLAIMS_FAILED",
        message: `Failed to get custom claims for ${uid}`,
        cause: error,
      }),
  }),

verifyAdminClaim: (sessionCookie) =>
  Effect.gen(function* () {
    const decoded = yield* Effect.tryPromise({
      try: () => auth.verifySessionCookie(sessionCookie, true),
      catch: (error) =>
        new SessionError({
          code: "SESSION_INVALID",
          message: "Session is invalid or expired",
        }),
    });

    return {
      uid: decoded.uid,
      email: decoded.email,
      isAdmin: decoded.admin === true,
    };
  }),
```

### 4. Extend FirestoreService for Admin Queries

Update `src/lib/effect/firestore.service.ts`:

```typescript
// Add to FirestoreService interface
readonly getAllMemberships: (
  params: MemberSearchParams
) => Effect.Effect<{ members: MemberWithMembership[]; total: number }, FirestoreError>;

readonly getStats: () => Effect.Effect<MembershipStats | null, FirestoreError>;

readonly updateStats: (
  stats: Partial<MembershipStats>
) => Effect.Effect<void, FirestoreError>;

readonly getMembershipAuditLog: (
  userId: string,
  limit?: number
) => Effect.Effect<Array<{ timestamp: Date; action: string; details: any }>, FirestoreError>;

readonly logAuditEntry: (
  userId: string,
  action: string,
  details: any
) => Effect.Effect<void, FirestoreError>;

// Add to implementation
getAllMemberships: (params) =>
  Effect.tryPromise({
    try: async () => {
      let query: FirebaseFirestore.Query = db.collectionGroup("memberships");

      // Apply filters
      if (params.status) {
        query = query.where("status", "==", params.status);
      }

      if (params.planType) {
        query = query.where("planType", "==", params.planType);
      }

      if (params.expiringWithinDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + params.expiringWithinDays);
        query = query.where("endDate", "<=", expiryDate);
      }

      // Order and paginate
      query = query.orderBy("endDate", "desc");

      const pageSize = params.pageSize || 20;
      const page = params.page || 1;
      const offset = (page - 1) * pageSize;

      // Get total count (separate query)
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Get page of results
      const snapshot = await query.offset(offset).limit(pageSize).get();

      // Fetch user data for each membership
      const members: MemberWithMembership[] = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const membership = { id: doc.id, ...doc.data() } as MembershipDocument;
          const userId = doc.ref.parent.parent!.id;

          // Fetch user
          const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
          const user = userDoc.exists
            ? ({ id: userDoc.id, ...userDoc.data() } as UserDocument)
            : null;

          // Fetch card
          const cardDoc = await db
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .collection("cards")
            .doc("current")
            .get();
          const card = cardDoc.exists
            ? ({ id: cardDoc.id, ...cardDoc.data() } as MembershipCard)
            : null;

          return { user: user!, membership, card };
        })
      );

      // Filter by search query if provided
      let filteredMembers = members;
      if (params.query) {
        const q = params.query.toLowerCase();
        filteredMembers = members.filter(
          (m) =>
            m.user?.email?.toLowerCase().includes(q) ||
            m.user?.name?.toLowerCase().includes(q) ||
            m.card?.membershipNumber?.toLowerCase().includes(q)
        );
      }

      return { members: filteredMembers, total };
    },
    catch: (error) =>
      new FirestoreError({
        code: "GET_ALL_MEMBERSHIPS_FAILED",
        message: "Failed to get all memberships",
        cause: error,
      }),
  }),

getStats: () =>
  Effect.tryPromise({
    try: async () => {
      const doc = await db.collection("stats").doc("memberships").get();
      if (!doc.exists) return null;
      return doc.data() as MembershipStats;
    },
    catch: (error) =>
      new FirestoreError({
        code: "GET_STATS_FAILED",
        message: "Failed to get membership stats",
        cause: error,
      }),
  }),

updateStats: (stats) =>
  Effect.tryPromise({
    try: () =>
      db
        .collection("stats")
        .doc("memberships")
        .set(
          { ...stats, updatedAt: new Date().toISOString() },
          { merge: true }
        ),
    catch: (error) =>
      new FirestoreError({
        code: "UPDATE_STATS_FAILED",
        message: "Failed to update membership stats",
        cause: error,
      }),
  }),

logAuditEntry: (userId, action, details) =>
  Effect.tryPromise({
    try: () =>
      db
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection("audit")
        .add({
          action,
          details,
          timestamp: FieldValue.serverTimestamp(),
        }),
    catch: (error) =>
      new FirestoreError({
        code: "AUDIT_LOG_FAILED",
        message: `Failed to log audit entry for ${userId}`,
        cause: error,
      }),
  }),
```

### 5. Create StatsService

Create `src/lib/effect/stats.service.ts`:

```typescript
import { Context, Effect, Layer, pipe } from "effect";
import { FirestoreService } from "./firestore.service";
import { FirestoreError } from "./errors";
import type { MembershipStats } from "./schemas";

// Service interface
export interface StatsService {
  readonly getStats: () => Effect.Effect<MembershipStats, FirestoreError>;

  readonly refreshStats: () => Effect.Effect<MembershipStats, FirestoreError>;

  readonly incrementStat: (
    stat: keyof Omit<MembershipStats, "updatedAt">,
    amount?: number
  ) => Effect.Effect<void, FirestoreError>;

  readonly decrementStat: (
    stat: keyof Omit<MembershipStats, "updatedAt">,
    amount?: number
  ) => Effect.Effect<void, FirestoreError>;
}

// Service tag
export const StatsService = Context.GenericTag<StatsService>("StatsService");

// Default stats
const defaultStats: MembershipStats = {
  totalMembers: 0,
  activeMembers: 0,
  expiredMembers: 0,
  canceledMembers: 0,
  individualCount: 0,
  familyCount: 0,
  monthlyRevenue: 0,
  yearlyRevenue: 0,
  updatedAt: new Date().toISOString(),
};

// Implementation
const make = Effect.gen(function* () {
  const firestore = yield* FirestoreService;

  return StatsService.of({
    // Get cached stats or calculate fresh
    getStats: () =>
      pipe(
        firestore.getStats(),
        Effect.flatMap((stats) =>
          stats
            ? Effect.succeed(stats)
            : Effect.succeed(defaultStats) // Return defaults if not initialized
        )
      ),

    // Force recalculation from all memberships
    refreshStats: () =>
      Effect.gen(function* () {
        const { members, total } = yield* firestore.getAllMemberships({});

        const stats: MembershipStats = {
          totalMembers: total,
          activeMembers: members.filter(
            (m) => m.membership?.status === "active" || m.membership?.status === "trialing"
          ).length,
          expiredMembers: members.filter((m) => {
            if (!m.membership) return false;
            const endDate = new Date(m.membership.endDate as any);
            return endDate < new Date() && m.membership.status !== "canceled";
          }).length,
          canceledMembers: members.filter(
            (m) => m.membership?.status === "canceled"
          ).length,
          individualCount: members.filter(
            (m) => m.membership?.planType === "individual"
          ).length,
          familyCount: members.filter(
            (m) => m.membership?.planType === "family"
          ).length,
          monthlyRevenue: 0, // Would need to fetch from Stripe
          yearlyRevenue: members.reduce((sum, m) => {
            if (m.membership?.status !== "active") return sum;
            return sum + (m.membership.planType === "family" ? 50 : 30);
          }, 0),
          updatedAt: new Date().toISOString(),
        };

        yield* firestore.updateStats(stats);

        return stats;
      }),

    incrementStat: (stat, amount = 1) =>
      pipe(
        firestore.getStats(),
        Effect.flatMap((current) =>
          firestore.updateStats({
            [stat]: (current?.[stat] || 0) + amount,
          })
        )
      ),

    decrementStat: (stat, amount = 1) =>
      pipe(
        firestore.getStats(),
        Effect.flatMap((current) =>
          firestore.updateStats({
            [stat]: Math.max(0, (current?.[stat] || 0) - amount),
          })
        )
      ),
  });
});

// Live layer
export const StatsServiceLive = Layer.effect(StatsService, make);
```

### 6. Create ExportService

Create `src/lib/effect/export.service.ts`:

```typescript
import { Context, Effect, Layer, pipe, Stream } from "effect";
import { FirestoreService } from "./firestore.service";
import { ExportError, FirestoreError } from "./errors";
import type { ExportOptions, MemberWithMembership } from "./schemas";

// Service interface
export interface ExportService {
  readonly generateCSV: (
    options: ExportOptions
  ) => Effect.Effect<string, ExportError | FirestoreError>;

  readonly generateJSON: (
    options: ExportOptions
  ) => Effect.Effect<string, ExportError | FirestoreError>;
}

// Service tag
export const ExportService = Context.GenericTag<ExportService>("ExportService");

// CSV helper
const escapeCSV = (value: string | null | undefined): string => {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Implementation
const make = Effect.gen(function* () {
  const firestore = yield* FirestoreService;

  const fetchMembers = (options: ExportOptions) =>
    pipe(
      firestore.getAllMemberships({
        status: options.statusFilter,
        pageSize: 1000, // Large batch for export
      }),
      Effect.map(({ members }) => members)
    );

  const memberToRow = (
    member: MemberWithMembership,
    options: ExportOptions
  ): string[] => {
    const row: string[] = [
      member.card?.membershipNumber || "",
      member.user?.name || "",
    ];

    if (options.includeEmail) {
      row.push(member.user?.email || "");
    }

    if (options.includePhone) {
      row.push(member.user?.phone || "");
    }

    if (options.includeAddress) {
      row.push(member.user?.address?.street || "");
      row.push(member.user?.address?.city || "");
      row.push(member.user?.address?.state || "");
      row.push(member.user?.address?.zip || "");
    }

    row.push(member.membership?.planType || "");
    row.push(member.membership?.status || "");
    row.push(
      member.membership?.startDate
        ? new Date(member.membership.startDate as any).toISOString().split("T")[0]
        : ""
    );
    row.push(
      member.membership?.endDate
        ? new Date(member.membership.endDate as any).toISOString().split("T")[0]
        : ""
    );
    row.push(member.membership?.autoRenew ? "Yes" : "No");

    return row;
  };

  return ExportService.of({
    generateCSV: (options) =>
      Effect.gen(function* () {
        const members = yield* fetchMembers(options);

        // Build header
        const headers: string[] = ["Membership Number", "Name"];
        if (options.includeEmail) headers.push("Email");
        if (options.includePhone) headers.push("Phone");
        if (options.includeAddress) {
          headers.push("Street", "City", "State", "ZIP");
        }
        headers.push("Plan Type", "Status", "Start Date", "End Date", "Auto-Renew");

        // Build rows
        const rows = members.map((m) =>
          memberToRow(m, options).map(escapeCSV).join(",")
        );

        // Combine
        const csv = [headers.join(","), ...rows].join("\n");

        yield* Effect.log(`Generated CSV export with ${members.length} members`);

        return csv;
      }),

    generateJSON: (options) =>
      Effect.gen(function* () {
        const members = yield* fetchMembers(options);

        const exportData = members.map((member) => {
          const data: Record<string, any> = {
            membershipNumber: member.card?.membershipNumber,
            name: member.user?.name,
            planType: member.membership?.planType,
            status: member.membership?.status,
            startDate: member.membership?.startDate,
            endDate: member.membership?.endDate,
            autoRenew: member.membership?.autoRenew,
          };

          if (options.includeEmail) {
            data.email = member.user?.email;
          }

          if (options.includePhone) {
            data.phone = member.user?.phone;
          }

          if (options.includeAddress) {
            data.address = member.user?.address;
          }

          return data;
        });

        yield* Effect.log(`Generated JSON export with ${members.length} members`);

        return JSON.stringify(exportData, null, 2);
      }),
  });
});

// Live layer
export const ExportServiceLive = Layer.effect(ExportService, make);
```

### 7. Create AdminService

Create `src/lib/effect/admin.service.ts`:

```typescript
import { Context, Effect, Layer, pipe } from "effect";
import { AuthService } from "./auth.service";
import { FirestoreService } from "./firestore.service";
import { StatsService } from "./stats.service";
import {
  AdminError,
  FirestoreError,
  NotFoundError,
  UnauthorizedError,
  SessionError,
} from "./errors";
import type {
  MembershipAdjustment,
  MemberWithMembership,
  MemberSearchParams,
} from "./schemas";

// Service interface
export interface AdminService {
  readonly verifyAdmin: (
    sessionCookie: string
  ) => Effect.Effect<{ uid: string; email?: string }, UnauthorizedError | SessionError>;

  readonly setAdminRole: (
    adminSessionCookie: string,
    targetUid: string,
    isAdmin: boolean
  ) => Effect.Effect<void, UnauthorizedError | AdminError>;

  readonly searchMembers: (
    params: MemberSearchParams
  ) => Effect.Effect<{ members: MemberWithMembership[]; total: number }, FirestoreError>;

  readonly getMember: (
    userId: string
  ) => Effect.Effect<MemberWithMembership, FirestoreError | NotFoundError>;

  readonly adjustMembership: (
    adminUid: string,
    adjustment: MembershipAdjustment
  ) => Effect.Effect<void, FirestoreError | NotFoundError | AdminError>;
}

// Service tag
export const AdminService = Context.GenericTag<AdminService>("AdminService");

// Implementation
const make = Effect.gen(function* () {
  const auth = yield* AuthService;
  const firestore = yield* FirestoreService;
  const stats = yield* StatsService;

  return AdminService.of({
    // Verify admin access
    verifyAdmin: (sessionCookie) =>
      pipe(
        auth.verifyAdminClaim(sessionCookie),
        Effect.flatMap((session) =>
          session.isAdmin
            ? Effect.succeed({ uid: session.uid, email: session.email })
            : Effect.fail(
                new UnauthorizedError({
                  message: "Admin access required",
                })
              )
        )
      ),

    // Set admin role for a user
    setAdminRole: (adminSessionCookie, targetUid, isAdmin) =>
      Effect.gen(function* () {
        // Verify caller is admin
        const admin = yield* pipe(
          auth.verifyAdminClaim(adminSessionCookie),
          Effect.flatMap((session) =>
            session.isAdmin
              ? Effect.succeed(session)
              : Effect.fail(
                  new UnauthorizedError({ message: "Admin access required" })
                )
          )
        );

        // Set custom claim
        yield* auth.setCustomClaims(targetUid, { admin: isAdmin });

        // Log the action
        yield* firestore.logAuditEntry(targetUid, "ADMIN_ROLE_CHANGE", {
          changedBy: admin.uid,
          newValue: isAdmin,
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(
          `Admin role ${isAdmin ? "granted to" : "revoked from"} ${targetUid} by ${admin.uid}`
        );
      }),

    // Search members
    searchMembers: (params) => firestore.getAllMemberships(params),

    // Get single member
    getMember: (userId) =>
      Effect.gen(function* () {
        const user = yield* firestore.getUser(userId);

        if (!user) {
          return yield* Effect.fail(
            new NotFoundError({ resource: "user", id: userId })
          );
        }

        const membership = yield* firestore.getActiveMembership(userId);
        const card = yield* firestore.getMembershipCard(userId);

        return { user, membership, card };
      }),

    // Adjust membership (admin override)
    adjustMembership: (adminUid, adjustment) =>
      Effect.gen(function* () {
        const { userId, membershipId, newEndDate, newStatus, reason } = adjustment;

        // Verify membership exists
        const membership = yield* firestore.getMembership(userId, membershipId);

        if (!membership) {
          return yield* Effect.fail(
            new NotFoundError({ resource: "membership", id: membershipId })
          );
        }

        // Prepare update
        const updateData: Record<string, any> = {};

        if (newEndDate) {
          updateData.endDate = new Date(newEndDate);
        }

        if (newStatus) {
          updateData.status = newStatus;

          // Update stats if status changed
          if (membership.status !== newStatus) {
            if (newStatus === "active") {
              yield* stats.incrementStat("activeMembers");
              if (membership.status === "canceled") {
                yield* stats.decrementStat("canceledMembers");
              }
            } else if (newStatus === "canceled") {
              yield* stats.incrementStat("canceledMembers");
              if (membership.status === "active") {
                yield* stats.decrementStat("activeMembers");
              }
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          return yield* Effect.fail(
            new AdminError({
              code: "NO_CHANGES",
              message: "No changes specified",
            })
          );
        }

        // Apply update
        yield* firestore.updateMembership(userId, membershipId, updateData);

        // Log audit entry
        yield* firestore.logAuditEntry(userId, "MEMBERSHIP_ADJUSTMENT", {
          adjustedBy: adminUid,
          membershipId,
          changes: updateData,
          reason,
          previousValues: {
            status: membership.status,
            endDate: membership.endDate,
          },
          timestamp: new Date().toISOString(),
        });

        yield* Effect.log(
          `Membership ${membershipId} adjusted by admin ${adminUid}: ${reason}`
        );
      }),
  });
});

// Live layer
export const AdminServiceLive = Layer.effect(AdminService, make);
```

### 8. Update Layer Composition

Update `src/lib/effect/layers.ts`:

```typescript
import { Layer } from "effect";
// ... existing imports
import { StatsService, StatsServiceLive } from "./stats.service";
import { ExportService, ExportServiceLive } from "./export.service";
import { AdminService, AdminServiceLive } from "./admin.service";

// Stats service (depends on Firestore)
const StatsLayer = StatsServiceLive.pipe(Layer.provide(FirestoreServiceLive));

// Export service (depends on Firestore)
const ExportLayer = ExportServiceLive.pipe(Layer.provide(FirestoreServiceLive));

// Admin service (depends on Auth + Firestore + Stats)
const AdminLayer = AdminServiceLive.pipe(
  Layer.provide(AuthServiceLive),
  Layer.provide(FirestoreServiceLive),
  Layer.provide(StatsServiceLive)
);

// Complete live layer with all services
export const LiveLayer = Layer.mergeAll(
  BaseServicesLayer,
  MembershipLayer,
  PortalLayer,
  CardLayer,
  StatsLayer,
  ExportLayer,
  AdminLayer
);

// Re-export for selective use
export { StatsLayer, ExportLayer, AdminLayer };
```

### 9. Create Admin Stats API Route

Create `app/api/admin/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { cookies } from "next/headers";
import { AdminService } from "@/src/lib/effect/admin.service";
import { StatsService } from "@/src/lib/effect/stats.service";
import { LiveLayer } from "@/src/lib/effect/layers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;
      const stats = yield* StatsService;

      // Verify admin access
      yield* admin.verifyAdmin(sessionCookie);

      // Get stats
      return yield* stats.getStats();
    }),

    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 403 })
    ),
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

// Refresh stats
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;
      const stats = yield* StatsService;

      yield* admin.verifyAdmin(sessionCookie);
      return yield* stats.refreshStats();
    }),

    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 403 })
    ),
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

### 10. Create Admin Members API Route

Create `app/api/admin/members/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { Schema as S } from "@effect/schema";
import { cookies } from "next/headers";
import { AdminService } from "@/src/lib/effect/admin.service";
import { LiveLayer } from "@/src/lib/effect/layers";
import { MemberSearchParams } from "@/src/lib/effect/schemas";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const params: S.Schema.Type<typeof MemberSearchParams> = {
    query: searchParams.get("query") || undefined,
    status: searchParams.get("status") as any || undefined,
    planType: searchParams.get("planType") as any || undefined,
    expiringWithinDays: searchParams.get("expiringWithinDays")
      ? parseInt(searchParams.get("expiringWithinDays")!)
      : undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
    pageSize: searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!)
      : 20,
  };

  const program = pipe(
    Effect.gen(function* () {
      const admin = yield* AdminService;

      // Verify admin access
      yield* admin.verifyAdmin(sessionCookie);

      // Search members
      return yield* admin.searchMembers(params);
    }),

    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 403 })
    ),
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

### 11. Create Export API Route

Create `app/api/admin/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Effect, pipe } from "effect";
import { Schema as S } from "@effect/schema";
import { cookies } from "next/headers";
import { AdminService } from "@/src/lib/effect/admin.service";
import { ExportService } from "@/src/lib/effect/export.service";
import { LiveLayer } from "@/src/lib/effect/layers";
import { ExportOptions } from "@/src/lib/effect/schemas";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  const program = pipe(
    // Validate options
    S.decodeUnknown(ExportOptions)(body),
    Effect.mapError(() => ({
      error: "Invalid export options",
      _tag: "error" as const,
      status: 400,
    })),

    Effect.flatMap((options) =>
      Effect.gen(function* () {
        const admin = yield* AdminService;
        const exportService = yield* ExportService;

        // Verify admin access
        yield* admin.verifyAdmin(sessionCookie);

        // Generate export
        if (options.format === "csv") {
          return {
            data: yield* exportService.generateCSV(options),
            contentType: "text/csv",
            filename: `members-export-${Date.now()}.csv`,
          };
        } else {
          return {
            data: yield* exportService.generateJSON(options),
            contentType: "application/json",
            filename: `members-export-${Date.now()}.json`,
          };
        }
      })
    ),

    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 403 })
    ),
    Effect.catchTag("SessionError", () =>
      Effect.succeed({ error: "Session expired", _tag: "error" as const, status: 401 })
    ),
    Effect.catchTag("FirestoreError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 })
    ),
    Effect.catchTag("ExportError", (error) =>
      Effect.succeed({ error: error.message, _tag: "error" as const, status: 500 })
    )
  );

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(LiveLayer))
  );

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Return file download
  return new NextResponse(result.data, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
```

### 12. Create Stats Cards Component

Create `src/components/admin/StatsCards.tsx`:

```typescript
"use client";

import { Grid, Card, CardContent, Typography, Skeleton } from "@mui/material";
import type { MembershipStats } from "@/lib/effect/schemas";

interface StatsCardsProps {
  stats: MembershipStats | null;
  loading: boolean;
}

const statCards = [
  { key: "totalMembers", label: "Total Members", color: "#1976d2" },
  { key: "activeMembers", label: "Active", color: "#2e7d32" },
  { key: "expiredMembers", label: "Expired", color: "#ed6c02" },
  { key: "canceledMembers", label: "Canceled", color: "#d32f2f" },
  { key: "individualCount", label: "Individual Plans", color: "#7b1fa2" },
  { key: "familyCount", label: "Family Plans", color: "#0288d1" },
] as const;

export function StatsCards({ stats, loading }: StatsCardsProps) {
  return (
    <Grid container spacing={2}>
      {statCards.map(({ key, label, color }) => (
        <Grid item xs={6} sm={4} md={2} key={key}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {label}
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={60} height={40} />
              ) : (
                <Typography
                  variant="h4"
                  sx={{ color, fontWeight: "bold" }}
                >
                  {stats?.[key] ?? 0}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Revenue card */}
      <Grid item xs={12} sm={6} md={4}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Annual Revenue
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={100} height={40} />
            ) : (
              <Typography variant="h4" sx={{ color: "#2e7d32", fontWeight: "bold" }}>
                ${stats?.yearlyRevenue?.toLocaleString() ?? 0}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
```

### 13. Create Member Table Component

Create `src/components/admin/MemberTable.tsx`:

```typescript
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TablePagination,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { MemberWithMembership } from "@/lib/effect/schemas";

interface MemberTableProps {
  members: MemberWithMembership[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEditMember: (member: MemberWithMembership) => void;
}

const statusColors: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  canceled: "error",
  expired: "error",
};

export function MemberTable({
  members,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEditMember,
}: MemberTableProps) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Membership #</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Plan</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Expires</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.user?.id}>
              <TableCell sx={{ fontFamily: "monospace" }}>
                {member.card?.membershipNumber || "—"}
              </TableCell>
              <TableCell>{member.user?.name || "—"}</TableCell>
              <TableCell>{member.user?.email}</TableCell>
              <TableCell>
                {member.membership?.planType === "family" ? "Family" : "Individual"}
              </TableCell>
              <TableCell>
                <Chip
                  label={member.membership?.status || "none"}
                  color={statusColors[member.membership?.status || ""] || "default"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {member.membership?.endDate
                  ? new Date(member.membership.endDate as any).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => onEditMember(member)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        rowsPerPage={pageSize}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value))}
        rowsPerPageOptions={[10, 20, 50, 100]}
      />
    </TableContainer>
  );
}
```

### 14. Update Webhook for Stats

Update `app/api/webhooks/stripe/route.ts` to update stats:

```typescript
// After processing subscription events, update stats
case "checkout.session.completed": {
  // ... existing processing

  // Update stats
  yield* Effect.gen(function* () {
    const stats = yield* StatsService;
    yield* stats.incrementStat("totalMembers");
    yield* stats.incrementStat("activeMembers");

    // Increment plan-specific counter
    const planType = PRICE_TO_PLAN[priceId] || "individual";
    if (planType === "family") {
      yield* stats.incrementStat("familyCount");
    } else {
      yield* stats.incrementStat("individualCount");
    }
  });
  break;
}

case "customer.subscription.deleted": {
  // ... existing processing

  // Update stats
  yield* Effect.gen(function* () {
    const stats = yield* StatsService;
    yield* stats.decrementStat("activeMembers");
    yield* stats.incrementStat("canceledMembers");
  });
  break;
}
```

## Effect-TS Pattern Guide (Phase 4)

### Admin Authorization Pattern

```typescript
// Always verify admin before operations
const program = pipe(
  Effect.gen(function* () {
    const admin = yield* AdminService;
    yield* admin.verifyAdmin(sessionCookie); // Throws if not admin
    // ... admin operations
  }),
  Effect.catchTag("UnauthorizedError", (e) => Effect.succeed({ error: e.message, status: 403 }))
);
```

### Stats Update Pattern

```typescript
// Use atomic increments for counters
yield* stats.incrementStat("activeMembers");
yield* stats.decrementStat("canceledMembers");

// Refresh full stats when needed
const freshStats = yield* stats.refreshStats();
```

### Export Pattern

```typescript
// Generate export based on format
const result = options.format === "csv"
  ? yield* exportService.generateCSV(options)
  : yield* exportService.generateJSON(options);
```

## Acceptance Criteria

- [ ] `AdminService` implemented with role verification and member management
- [ ] `StatsService` implements analytics caching and refresh
- [ ] `ExportService` generates CSV and JSON exports
- [ ] Firebase Auth custom claims used for admin role
- [ ] Admin stats endpoint returns cached analytics
- [ ] Member search supports filtering by status, plan, expiration
- [ ] Membership adjustments create audit log entries
- [ ] CSV export includes configurable fields
- [ ] Stats updated automatically via webhook events
- [ ] All admin operations require admin claim verification
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)

## Validation Commands

```bash
# Verify TypeScript compilation
pnpm tsc --noEmit

# Build Next.js
pnpm build

# Test admin stats
curl http://localhost:3000/api/admin/stats \
  -H "Cookie: session=..."

# Test member search
curl "http://localhost:3000/api/admin/members?status=active&page=1" \
  -H "Cookie: session=..."

# Test CSV export
curl -X POST http://localhost:3000/api/admin/export \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"includeEmail":true,"includePhone":false,"includeAddress":false,"format":"csv"}'

# Set admin claim (run in Firebase console or Cloud Function)
firebase auth:import --hash-algo=STANDARD_SCRYPT
```

## Environment Variables Required

No additional environment variables required for Phase 4.

## Notes

- Custom claims require Firebase Admin SDK to set
- Stats are denormalized for fast reads
- Collection group queries require Firestore index
- Audit logs provide compliance trail for membership changes
- Export large datasets may require streaming or pagination

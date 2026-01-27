# Plan: Upgrade Next.js 14 → 16.1.5 & React 19.2.4 (CVE-2026-23864)

## Task Description

Upgrade from Next.js 14 to 16.1.5 and React from 19.2.1 to 19.2.4 to remediate CVE-2026-23864 (DoS vulnerabilities in React Server Components, CVSS 7.5). This is a two-major-version jump requiring careful migration through breaking changes in both Next.js 15 and 16.

## Objective

All dependencies upgraded, all breaking changes addressed, build passing, and CVE-2026-23864 remediated.

## Problem Statement

CVE-2026-23864 affects `react-server-dom-webpack` / `react-server-dom-turbopack` packages bundled with Next.js. Specially crafted HTTP requests to Server Function endpoints can cause server crashes, OOM, or excessive CPU. The fix requires Next.js 16.1.5+ and React 19.2.4+.

## Solution Approach

Upgrade in phases: dependencies first, then address each category of breaking changes systematically. Use Next.js codemods where available. The project uses App Router exclusively with ~46 files, 25 API routes, middleware, and server actions — all areas affected by breaking changes.

## Relevant Files

**Config files:**

- `package.json` — version bumps
- `next.config.js` — must migrate to `next.config.ts`, rename experimental options, address image config changes
- `tsconfig.json` — may need updates for new Next.js types
- `middleware.ts` — must rename to `proxy.ts` (Next.js 16 breaking change)

**Files using `cookies()` / `headers()` (must await):**

- `src/lib/api/admin-route-handler.ts`
- `src/utils/auth.ts`
- `src/actions/portal.ts`
- `src/actions/auth.ts`
- `app/api/admin/check/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/trails/[id]/route.ts`
- `app/api/portal/route.ts`
- `app/api/membership/card/route.ts`
- `app/api/member/dashboard/route.ts`
- `app/api/member/check-session/route.ts`
- `app/api/auth/session/route.ts`

**Files using `params` / `searchParams` (must await):**

- `app/auth-handler/page.tsx`
- `app/thanks/page.tsx`
- `app/member/page.tsx`
- `app/join/page.tsx`
- `app/blog/page.tsx`
- `app/blog/[slug]/page.tsx`
- `app/api/admin/members/route.ts`
- `app/api/admin/members/expiring/route.ts`
- `app/api/admin/members/[userId]/route.ts`
- `app/api/admin/members/[userId]/refund/route.ts`
- `app/api/admin/members/[userId]/payment-history/route.ts`
- `app/api/admin/members/[userId]/audit/route.ts`
- `app/api/admin/verify/[membershipNumber]/route.ts`
- `app/api/admin/reconcile/route.ts`
- `app/api/trails/[id]/route.ts`
- `app/api/membership/[userId]/route.ts`

## Implementation Phases

### Phase 1: Dependencies & Config

Update all package versions and configuration files.

### Phase 2: Async API Migration

Convert all `cookies()`, `headers()`, `params`, and `searchParams` usage to async/await.

### Phase 3: Middleware → Proxy

Rename middleware file and update exports.

### Phase 4: Next.js Config Migration

Address `experimental.serverComponentsExternalPackages` rename, image config defaults, and Turbopack compatibility.

### Phase 5: Validation

Run type checks, lint, tests, and build to confirm everything works.

## Step by Step Tasks

### 1. Create a new branch

- `git checkout -b upgrade-next-16-cve-2026-23864`

### 2. Update package.json dependencies

- `next`: `^14` → `16.1.5`
- `react`: `^19.2.1` → `19.2.4`
- `react-dom`: `^19.2.1` → `19.2.4`
- `@types/react`: `^18` → `^19`
- `@types/react-dom`: `^18` → `^19`
- `eslint-config-next`: `^14` → `16.1.5`
- `@netlify/plugin-nextjs`: check compatibility with Next.js 16
- Run `pnpm install`

### 3. Run the Next.js upgrade codemod

- `npx @next/codemod@canary upgrade 16.1.5`
- This will attempt to auto-fix: async dynamic APIs, middleware → proxy rename, config changes
- Review all changes made by the codemod

### 4. Migrate next.config.js

- Rename `experimental.serverComponentsExternalPackages` → `serverExternalPackages` (top-level)
- Remove `onDemandEntries` if deprecated
- Consider converting `next.config.js` → `next.config.ts` (optional but recommended)
- Verify image config — `minimumCacheTTL` default changed from 60s to 4hrs, `imageSizes` no longer includes 16px

### 5. Rename middleware.ts → proxy.ts

- Rename the file: `middleware.ts` → `proxy.ts`
- Rename the export: `export function middleware(request)` → `export function proxy(request)`
- Update `config.matcher` if `skipMiddlewareUrlNormalize` was used (rename to `skipProxyUrlNormalize`)
- Note: If you need to keep Edge runtime, you can keep `middleware.ts` instead. The current middleware uses no Edge-specific APIs, so either approach works.

### 6. Convert cookies() and headers() to async

For each of the 12 files using `cookies()` or `headers()`:

- Change `const cookieStore = cookies()` → `const cookieStore = await cookies()`
- Change `const headersList = headers()` → `const headersList = await headers()`
- Ensure the containing function is `async`
- Files: `admin-route-handler.ts`, `auth.ts` (utils), `portal.ts`, `auth.ts` (actions), and all 8 API route files listed above

### 7. Convert params and searchParams to async

For each of the 16 files using `params` or `searchParams`:

- Change `{ params }` → `props` then `const { slug } = await props.params`
- Change `{ searchParams }` → `const searchParams = await props.searchParams`
- Ensure page/layout/route handler functions are `async`
- Use `PageProps<'/path/[param]'>` type helpers if available after running `npx next typegen`

### 8. Address fetch caching behavior changes (Next.js 15+)

- `fetch()` is no longer cached by default
- GET route handlers are no longer cached by default
- Review API routes and add `cache: 'force-cache'` where previous caching behavior is desired
- Or add `export const dynamic = 'force-static'` to GET route handlers that should be cached

### 9. Verify Turbopack compatibility

- Run `pnpm build` (Turbopack is now default in Next.js 16)
- If webpack-specific config causes issues, either:
  - Migrate to Turbopack-compatible config
  - Or temporarily use `next build --webpack` in package.json

### 10. Update @netlify/plugin-nextjs

- Check if current version supports Next.js 16
- If not, upgrade to latest version or find alternative deployment config
- Test deployment locally with `netlify dev` if possible

### 11. Run full validation suite

- `pnpm tsc` — fix all type errors
- `pnpm lint` — fix all lint issues
- `pnpm format` — format all files
- `pnpm test:run` — all tests must pass
- `pnpm build` — must build successfully

### 12. Smoke test critical flows

- Authentication (login, session, protected routes)
- Member dashboard
- Stripe webhook handling
- Blog pages with dynamic slugs
- Admin routes

## Testing Strategy

- Run existing test suite after each phase
- Type-check after each batch of file changes
- Build after all changes complete
- Manual smoke test of auth flow, member dashboard, and Stripe webhooks

## Acceptance Criteria

- [ ] `next` version is `16.1.5`
- [ ] `react` and `react-dom` versions are `19.2.4`
- [ ] `@types/react` and `@types/react-dom` are `^19`
- [ ] All `cookies()` and `headers()` calls are awaited
- [ ] All `params` and `searchParams` are awaited
- [ ] `middleware.ts` renamed to `proxy.ts` with updated export (or kept as middleware if Edge runtime needed)
- [ ] `next.config.js` uses `serverExternalPackages` instead of `experimental.serverComponentsExternalPackages`
- [ ] `pnpm tsc` passes with no errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test:run` passes
- [ ] `pnpm build` succeeds

## Validation Commands

- `pnpm tsc` — TypeScript compilation check
- `pnpm lint` — Linting check
- `pnpm format` — Code formatting
- `pnpm test:run` — Run test suite
- `pnpm build` — Full production build

## Notes

- The Netlify plugin (`@netlify/plugin-nextjs`) may not yet support Next.js 16. Check <https://github.com/netlify/next-runtime> for compatibility. If unsupported, consider pinning to a canary/beta version or using Vercel for deployment.
- The codemod (`npx @next/codemod@canary upgrade`) should handle many changes automatically. Run it first, then manually fix what it misses.
- `@effect/schema` (`^0.75.5`) — verify compatibility with React 19.2.4 (likely fine, no React dependency).
- MUI (`6.4.x`) — verify compatibility with React 19.2.4. MUI 6 supports React 19.
- Consider running `npx next typegen` after upgrade to generate route-typed helpers for params.

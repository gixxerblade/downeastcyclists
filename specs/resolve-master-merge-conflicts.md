# Plan: Resolve Master Merge Conflicts

## Task Description

Resolve merge conflicts between the `stripe_implementation` branch and `origin/master`. The branches diverged from commit `0e698d3` and have 60 files with conflicts due to parallel development tracks.

## Objective

Merge `origin/master` into `stripe_implementation` branch, resolving all conflicts while preserving:

1. All Stripe integration functionality from `stripe_implementation`
2. Formatting updates (oxfmt) from `master`
3. Updated package versions where appropriate

## Problem Statement

The `stripe_implementation` branch and `origin/master` have diverged significantly:

**stripe_implementation branch added:**

- Stripe membership management with Effect-TS
- AuthProvider component wrapper
- Vitest testing infrastructure
- QR code generation libraries
- Updated package versions (oxfmt 0.24.0, oxlint 1.39.0)

**origin/master added:**

- oxfmt code formatting across all files (double quotes, spacing)
- Netlify cache improvements
- Contact form updates

**Root cause of conflicts:**
The oxfmt formatter on master reformatted many files (changing import quote styles, spacing), creating conflicts with the stripe_implementation branch which didn't have these formatting changes.

## Solution Approach

Use a strategic merge resolution approach:

1. Take the stripe_implementation version for all functional code (preserves Stripe features)
2. After merge, run `oxfmt` to apply consistent formatting across all files
3. Manually verify critical integration points (AuthProvider, package.json)

## Relevant Files

### Configuration Files (Critical - Manual Resolution Required)

- `package.json` - Merge dependencies from both branches, keep newer versions
- `pnpm-lock.yaml` - Regenerate after package.json resolution
- `tailwind.config.ts` - Keep stripe_implementation version
- `middleware.ts` - Keep stripe_implementation version (has auth middleware)

### App Layout Files (Keep stripe_implementation)

- `app/layout.tsx` - Has AuthProvider wrapper, essential for Stripe
- `app/login/page.tsx` - Has auth functionality
- `app/dashboard/page.tsx` - May have member dashboard features

### API Routes (Keep stripe_implementation)

- `app/api/trails/[id]/route.ts`
- `app/api/trails/route.ts`

### Components (Keep stripe_implementation, reformat after)

- `src/components/navbar.tsx`
- `src/components/footer.tsx`
- `src/components/FooterWrapper.tsx`
- `src/components/ThemeRegistry/*.ts(x)`
- `src/components/TrailStatus.tsx`
- `src/components/TrailStatusEditor.tsx`

### Contentful Files (Keep stripe_implementation, reformat after)

- `src/contentful/*.ts`
- `src/contentful/types/*.ts`

### Utility Files (Keep stripe_implementation)

- `src/utils/auth.ts` - Auth utilities
- `src/utils/firebase.ts` - Firebase config
- `src/utils/trails.ts`

### Icon Files (Formatting only - take either, reformat)

- `src/icons/*.tsx`
- `assets/icons/DecLogo.tsx`

### Other Files (Keep stripe_implementation, reformat after)

- `src/hooks/*.ts`
- `src/providers/QueryProvider.tsx`
- `src/data/*.tsx`
- `constants/QueryKeys.ts`
- Pages directory files (`pages/*.js`)
- `netlify/edge-functions/geo-block.js`
- `public/sw.js`

## Implementation Phases

### Phase 1: Merge and Bulk Resolution

Apply merge with ours strategy for majority of files (format-only conflicts), then manually handle critical files.

### Phase 2: Manual Resolution

Carefully merge package.json and any files with actual code conflicts (not just formatting).

### Phase 3: Formatting and Validation

Run oxfmt to standardize formatting, then validate with linting, tests, and build.

## Step by Step Tasks

### 1. Create Backup Branch

- Create a backup of current state: `git branch backup-stripe-implementation`
- This allows easy recovery if merge goes wrong

### 2. Start the Merge

- Run `git merge origin/master`
- Note all conflicting files

### 3. Bulk Resolution - Accept Ours (stripe_implementation)

For all files EXCEPT package.json, accept the stripe_implementation version:

```bash
git checkout --ours app/about/bylaws/page.tsx
git checkout --ours app/about/leadership/page.tsx
git checkout --ours app/about/membership/page.tsx
git checkout --ours app/about/page.tsx
git checkout --ours app/about/privacy/page.tsx
git checkout --ours app/api/trails/[id]/route.ts
git checkout --ours app/api/trails/route.ts
git checkout --ours app/blog/[slug]/page.tsx
git checkout --ours app/blog/page.tsx
git checkout --ours app/contact/page.tsx
git checkout --ours app/dashboard/page.tsx
git checkout --ours app/layout.tsx
git checkout --ours app/login/page.tsx
git checkout --ours app/not-found.tsx
git checkout --ours app/page.tsx
git checkout --ours app/thanks/page.tsx
git checkout --ours app/trails/b3/page.tsx
git checkout --ours assets/icons/DecLogo.tsx
git checkout --ours constants/QueryKeys.ts
git checkout --ours middleware.ts
git checkout --ours netlify/edge-functions/geo-block.js
git checkout --ours pages/_app.js
git checkout --ours pages/_document.js
git checkout --ours pages/api/form-submission.js
git checkout --ours public/sw.js
git checkout --ours src/components/FooterWrapper.tsx
git checkout --ours src/components/ThemeRegistry/EmotionCache.tsx
git checkout --ours src/components/ThemeRegistry/ThemeRegistry.tsx
git checkout --ours src/components/ThemeRegistry/theme.ts
git checkout --ours src/components/TrailStatus.tsx
git checkout --ours src/components/TrailStatusEditor.tsx
git checkout --ours src/components/footer.tsx
git checkout --ours src/components/navbar.tsx
git checkout --ours src/contentful/b3.ts
git checkout --ours src/contentful/blogPosts.ts
git checkout --ours src/contentful/bylaws.ts
git checkout --ours src/contentful/contentImage.ts
git checkout --ours src/contentful/contentfulClient.ts
git checkout --ours src/contentful/leaders.ts
git checkout --ours src/contentful/privacy.ts
git checkout --ours src/contentful/types/TypeBlogPost.ts
git checkout --ours src/contentful/types/TypeBylaw.ts
git checkout --ours src/contentful/types/TypeLeaders.ts
git checkout --ours src/contentful/types/TypePrivacy.ts
git checkout --ours src/contentful/video.ts
git checkout --ours src/data/bylaws.tsx
git checkout --ours src/data/privacy.tsx
git checkout --ours src/hooks/useCachedFetch.ts
git checkout --ours src/hooks/useTrailQueries.ts
git checkout --ours src/icons/BicycleGallery.tsx
git checkout --ours src/icons/BicycleShop.tsx
git checkout --ours src/icons/CapeFearCyclists.tsx
git checkout --ours src/icons/CapeFearSorba.tsx
git checkout --ours src/icons/Icons.tsx
git checkout --ours src/providers/QueryProvider.tsx
git checkout --ours src/utils/auth.ts
git checkout --ours src/utils/firebase.ts
git checkout --ours src/utils/trails.ts
git checkout --ours tailwind.config.ts
```

- Add all resolved files: `git add <files>`

### 4. Resolve package.json Manually

- Keep ALL dependencies from stripe_implementation (includes Stripe, qrcode, vitest)
- Keep the newer versions of oxfmt (0.24.0) and oxlint (1.39.0) from stripe_implementation
- Ensure scripts section includes all test scripts AND format script from both:
  ```json
  "scripts": {
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "format": "oxfmt",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
  ```
- Add resolved package.json: `git add package.json`

### 5. Regenerate pnpm-lock.yaml

- Delete conflicted lockfile: `rm pnpm-lock.yaml`
- Regenerate: `pnpm install`
- Add lockfile: `git add pnpm-lock.yaml`

### 6. Apply Consistent Formatting

- Run formatter on all TypeScript/JavaScript files: `pnpm fmt`
- This ensures consistent style across the merged codebase

### 7. Complete the Merge

- Stage any remaining files: `git add -A`
- Commit the merge: `git commit -m "Merge origin/master into stripe_implementation"`

### 8. Validate the Merge

- Run TypeScript check: `pnpm tsc`
- Run linter: `pnpm lint`
- Run tests: `pnpm test:run`
- Run build: `pnpm build`

### 9. Fix Any Issues

- If validation fails, fix issues iteratively
- Re-run validation after each fix

## Testing Strategy

- All existing tests must pass after merge
- Run full test suite: `pnpm test:run`
- Manual verification:
  - Auth flow works (login/logout)
  - Stripe integration pages load
  - Member dashboard accessible after login

## Acceptance Criteria

- [ ] All 60 conflicting files resolved
- [ ] Merge commit created successfully
- [ ] TypeScript compiles with no errors (`pnpm tsc`)
- [ ] Linter passes (`pnpm lint`)
- [ ] All tests pass (`pnpm test:run`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Application starts and basic navigation works

## Validation Commands

Execute these commands to validate the task is complete:

- `pnpm tsc` - Verify TypeScript compilation
- `pnpm lint` - Verify linting passes
- `pnpm test:run` - Verify all tests pass
- `pnpm build` - Verify production build succeeds
- `git log -1` - Verify merge commit exists
- `git status` - Verify clean working tree

## Notes

- If the merge becomes too complex, an alternative approach is to rebase:

  ```bash
  git rebase origin/master
  ```

  This applies stripe_implementation commits on top of master, but may require resolving each commit separately.

- Another alternative is to use a merge tool:

  ```bash
  git mergetool
  ```

  This opens a visual merge tool for each conflict.

- After successful merge, consider pushing to remote:
  ```bash
  git push origin stripe_implementation
  ```

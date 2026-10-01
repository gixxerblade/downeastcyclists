---
name: domain-boundaries
description: Preserve domain ownership and separate business rules from delivery code when adding, changing, or reviewing membership, billing, access, renewal, reporting, trail-maintenance, or event-ingestion behavior in Downeast Cyclists. Use for cross-module refactors too; purely visual or copy edits do not need this workflow.
---

# Downeast Domain Boundaries

Adapted from the user’s Python/web variant of the
[Super-Genius engineering constraints](https://gist.github.com/Super-Genius/6b263b852949f99e572ecfdf3d23b886).
The original is C++-specific; this skill follows Downeast Cyclists’ TypeScript,
Next.js, and Effect architecture.

Apply the hard architecture invariants in the worktree-root `AGENTS.md`.
These are design constraints, not a ceremony for every edit. Within those boundaries,
choose the lowest future maintenance cost. Explain a material tradeoff in the commit
or PR description when one is requested, otherwise in the handoff. This skill does
not authorize a commit, a deployment, or a repo-wide cleanup.

## Locate the owner before editing

Work in the active app worktree, not the bare repository container. Inspect its
current code; the paths below are starting points, not a mandate to reorganize it.
Name each edited file's primary concern in the working plan or handoff, not in
boilerplate comments.

| Concern                                                    | Existing starting points                                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Membership lifecycle and checkout orchestration            | `src/lib/effect/membership.service.ts`                                                                                                                    |
| Membership status, expiration, and reminder-day predicates | `src/lib/membership-status.ts`                                                                                                                            |
| Membership access and role policy                          | `src/lib/membership-access.ts`, `src/lib/access-control.ts`                                                                                               |
| Plan configuration                                         | `src/lib/membership-plans-config.ts`; inspect Stripe service callers to distinguish configured display prices from provider-authoritative billing amounts |
| Renewal scheduling                                         | `src/lib/effect/renewal-reminders.ts`                                                                                                                     |
| Persistence                                                | `src/db/schema/`, `drizzle/`, `src/lib/effect/database.service.ts`, `database-*.methods.ts`, `src/lib/trail-maintenance/repository.ts`                    |
| Trail reports and event ingestion                          | `src/lib/trail-maintenance/`, `src/lib/meetup/`                                                                                                           |
| Delivery and presentation                                  | `app/api/**/route.ts`, `netlify/functions/`, React pages/components, and `src/lib/effect/client-*.ts`                                                     |

Follow public functions and service contracts. A domain can contain several cohesive
files; one owner does not mean one giant service. Extend the existing owner before
creating a new one, and explain why an existing owner cannot own a proposed new rule.
Keep each domain's rule documentation beside its owner or in a linked `docs/` file;
update existing documentation first and document touched rules when none exists.
Do not invent policy to fill documentation gaps.

## Refactor before changing behavior

Search with `rg` for the rule's symbols AND its actual expressions: date arithmetic,
status sets, thresholds, prices, format strings, schema fields, and repeated UI.
Record the matching callers and distinguish the same rule from coincidental similarity.

For a second use, extract or reuse the appropriate owner, migrate existing callers,
and verify unchanged behavior before implementing the new use. Preserve each caller's
guards, rounding, clamping, timezone handling, null handling, and output shape. Different
semantics may need distinct named functions; do not silently normalize them.

Consolidate scattered instances of the touched rule before extending it. Keep this
bounded to the requested change. If an existing copy cannot safely move, identify its
path and reason in the handoff and any requested commit; do not claim deduplication
is complete or add another copy.

Make extraction and behavior change separately verifiable stages, with separate commits
when commits are requested. Run relevant existing tests after extraction; add focused
characterization tests where behavior is unprotected. For billing, membership expiry,
or aggregate statistics, compare representative before/after outputs with a fixed
clock and synthetic fixtures. Never dump real member records or credentials.

## Keep the boundaries useful

- Pure rule functions accept and return typed domain values. Keep Next.js requests,
  responses, React, cookies, and headers at delivery boundaries. Existing Effect
  services may compose typed effects and injected services; do not replace them with
  classes or plain functions merely to satisfy a slogan. When available, use the local `effect-ts`
  skill when implementing Effect code; otherwise inspect the existing services and
  `docs/EFFECT_CLIENT_ARCHITECTURE.md` for repository conventions.
- Domain callers use persistence and provider contracts instead of reaching into
  tables, caches, or SDK internals. Database adapters may query tables and perform
  query aggregation; the owning domain defines the business meaning of that query.
- Routes, scheduled entrypoints, and client adapters decode inputs, invoke owners,
  and translate results/errors. React renders results. Layout arithmetic, display
  formatting, and UI state are fine; locally redefining renewal eligibility, prices,
  membership classification, or access rules is not.
- A browser may reuse a browser-safe pure rule for previews or validation. The server
  recomputes authoritative decisions and enforces permissions before returning
  protected data or performing actions. Hiding a component is not access control.
- Persist each fact in its canonical schema and derive types where practical.
  Transport validation and database constraints have different jobs; share their
  underlying facts without forcing incompatible representations into one schema.
  Reuse components for repeated UX with the same behavior, not just similar markup.
- Prefer types and boundary validation that make invalid domain states hard to
  represent. Keep dependencies explicit so a feature can be deleted without
  disturbing unrelated modules.
- Prefer small functions and composition. Split unrelated responsibilities, not
  every function whose description contains “and.” Add extension points only for
  demonstrated variation; avoid speculative flags, wrappers, and frameworks.
- Resolve circular ownership rather than hiding cycles with dynamic imports.
  Preserve lazy loading that has a separate demonstrated runtime purpose.
- Validate external inputs at boundaries and propagate meaningful errors. Preserve
  deliberate recovery and typed Effect failures; never turn an unexpected failure
  into a success-shaped default. Names explain intent; comments explain why.

## Enforce what can be checked

Run the quality gate required by `AGENTS.md` from the active app worktree after code
changes. For a concrete invariant introduced or changed by the task, use a focused
behavioral test, schema constraint, or import-boundary check in the existing tooling
and ensure CI or a hook runs it. Check that enforcement fails for an actual violation;
do not test that documentation contains a phrase or ban all arithmetic with a regex.

Inspect `.github/workflows/ci.yml` rather than assuming local checks run in CI.
Passing types, lint, tests, formatting, and build alone does not prove domain ownership
or absence of duplicated rules. Identify any remaining manual review constraint
explicitly. Adding this skill does not itself install architectural enforcement.

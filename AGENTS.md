# Git Worktrees

Use [`git-wt`](https://gabri.me/blog/git-wt) for worktree management in this repository instead of invoking `git worktree` directly.

- Before starting work on a new branch, create an isolated worktree with `git wt add -b <branch-name> <worktree-name>`.
- To check out an existing remote branch, use `git wt add <worktree-name> origin/<branch-name>`.
- Run `git wt add` without arguments when interactive branch selection is useful and `fzf` is available.
- Use `git wt switch` to select an existing worktree. Because it prints the selected path, change directories with `cd "$(git wt switch)"` when needed.
- Use `git wt list` to inspect active worktrees.
- Run `git wt update` periodically to fetch remotes and fast-forward the default branch when possible.
- Remove a finished worktree with `git wt remove <worktree-name>`. This also deletes its local branch, so first confirm the branch is merged or its work is safely pushed.
- Do not run `git wt destroy` unless the user explicitly requests deletion of the worktree, local branch, and remote branch. Verify the exact branch name and explain the impact before running it.
- Do not run `git wt migrate` in this repository unless the user explicitly requests the repository conversion. It restructures an existing clone and is documented as experimental.
- Do not run `git wt clone` inside this existing checkout; it is for creating a new bare-repository worktree layout.
- Commands not implemented specially by `git-wt`, such as `list`, `prune`, and `lock`, pass through to native `git worktree`.

# Quality Checks

Run all quality checks from the root of the active worktree after making the final code changes:

```shell
pnpm tsgo
pnpm lint
pnpm test:run
pnpm fmt:check
pnpm build
```

- Every command above must pass before work is considered complete, before creating a commit, and before creating or updating a pull request.
- `pnpm tsgo` is the required type-check command. The current `pnpm tsc` script invokes the same native TypeScript compiler and may be used for troubleshooting, but running both is unnecessary.
- Use `pnpm test:run` for the completion gate because it runs Vitest once and exits. Do not use the watch-mode `pnpm test` command as the final check.
- Use `pnpm fmt` to fix formatting when needed, then rerun `pnpm fmt:check`.
- If any quality check changes files or a later edit is made, rerun the affected checks. Before committing or creating/updating a pull request, rerun the full five-command gate.
- Do not claim completion, create a commit, or create/update a pull request while any required check is failing. Report the failure and its relevant output instead.

# Architecture Invariants

For changes to business behavior or cross-module refactors, use
[domain-boundaries](.agents/skills/domain-boundaries/SKILL.md). These invariants apply
regardless of whether the skill is automatically selected. Numbers 10–12 retain the
identifiers of the source architecture policy.

10. **One owner per domain rule.** Business rules belong to the existing owning
    module under `src/lib/`, including Effect services and domain helpers. A module
    may have multiple cohesive files. Keep its rule documentation with the owner
    or in a linked `docs/` file. Extend that owner and consolidate scattered copies
    of the touched rule before adding behavior. Other modules call its public
    contracts; they do not reach into its private tables or caches. Do not hide
    ownership cycles with function-local or dynamic imports.
11. **One implementation per rule.** Before adding logic, search for both names and
    expressions, including thresholds, arithmetic, formats, and schema facts.
    On a second use, reuse or extract the owner and migrate existing callers in a
    behavior-preserving step before adding behavior. Preserve guards, rounding,
    clamps, and edge cases. Name any copies left behind and why in the handoff and
    any requested commit; a new helper beside old copies is not deduplication.
    Share canonical schema facts and repeated UI behavior without abstracting
    coincidental similarity or removing necessary boundary validation.
12. **No business decisions in presentation or transport.** React components,
    pages, route handlers, scheduled entrypoints, and client adapters call domain
    owners instead of defining prices, eligibility, membership classifications,
    or access policy. Display formatting, layout arithmetic, and UI state are
    allowed. Shared browser-safe rules may support previews, but the server must
    independently enforce authorization and authoritative business decisions.
    Pure rules consume typed values; Next.js and React concerns stay at the edges.

Choose the lowest future maintenance cost when softer design preferences conflict;
explain material tradeoffs in the handoff and any requested commit. Do not override
these hard invariants for convenience. Keep refactors and behavior changes separately
verifiable. Enforce concrete critical rules with tests, schema constraints, or boundary
checks run by CI or hooks; instructions alone are not enforcement. Report enforcement
gaps honestly rather than treating a passing build as proof of architecture.

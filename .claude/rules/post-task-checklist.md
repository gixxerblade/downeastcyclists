# Post-Task Quality Checks (REQUIRED)

After completing any task, you MUST run the following commands in order and fix any issues before considering the task complete:

## 1. TypeScript Check

```bash
pnpm tsc
```

- Fix all type errors before proceeding

## 2. Lint

```bash
pnpm lint
```

- Fix all type errors in files you modified
- Auto-fix where possible: `pnpm lint --fix`

## 3. Format

```bash
pnpm format
```

- Ensure consistent code style across all files

## 4. Test

```bash
pnpm test
```

- All tests must pass
- If tests fail, fix the code or update tests appropriately

## 5. Build

```bash
pnpm build
```

- Verify the project builds successfully
- No build errors or warnings allowed

## If Any Step Fails

- Fix the issues immediately
- Re-run all checks from step 1
- Do not mark the task as complete until ALL checks pass

## Final Report

After all checks pass, provide a summary:

```md
✅ TypeScript: No errors
✅ Lint: No issues  
✅ Format: All files formatted
✅ Tests: X passing
✅ Build: Successful
```

**Task is only complete when all 5 checks pass successfully.**

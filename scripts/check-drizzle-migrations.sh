#!/usr/bin/env sh
set -eu

pnpm db:generate

git diff --exit-code -- drizzle

status="$(git status --short --untracked-files=all -- drizzle)"
if [ -n "$status" ]; then
  printf '%s\n' "$status"
  exit 1
fi

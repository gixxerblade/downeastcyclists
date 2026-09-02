#!/usr/bin/env sh

set -eu

repo_dir=".repos/effect"

# The checkout is only used for local Effect research. CI builds do not need it,
# and cached CI workspaces may contain a source directory without Git metadata.
if [ "${CI:-}" = "true" ]; then
  exit 0
fi

if git -C "$repo_dir" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

git submodule update --init -- "$repo_dir"

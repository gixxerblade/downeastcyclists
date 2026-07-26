#!/usr/bin/env sh

set -eu

repo_dir=".repos/effect"
repo_url="https://github.com/Effect-TS/effect-smol"

# The checkout is only used for local Effect research. CI builds do not need it,
# and cached CI workspaces may contain a source directory without Git metadata.
if [ "${CI:-}" = "true" ]; then
  exit 0
fi

if [ -d "$repo_dir/.git" ]; then
  exit 0
fi

mkdir -p ".repos"
git clone "$repo_url" "$repo_dir"

#!/usr/bin/env sh
set -eu

if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi

bun i -g tuturuuu
ttr help

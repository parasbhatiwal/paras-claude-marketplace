#!/bin/sh
# One-time per-clone setup: point git at the committed team hooks.
# Usage: sh .githooks/../setup-git-hooks.sh   (or via your bootstrap/Makefile)

set -e
cd "$(git rev-parse --show-toplevel)"

if [ ! -d .githooks ]; then
  echo "✗ .githooks/ not found — copy the team githooks/ templates to .githooks/ first" >&2
  exit 1
fi

if [ ! -f .githooks/_lib.sh ]; then
  echo "✗ .githooks/_lib.sh missing — the hooks source it for language" >&2
  echo "  detection; copy the whole githooks/ directory, not individual files." >&2
  exit 1
fi

chmod +x .githooks/*
git config core.hooksPath .githooks
echo "✓ git hooks installed (core.hooksPath → .githooks)"

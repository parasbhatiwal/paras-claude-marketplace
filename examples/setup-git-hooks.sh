#!/bin/sh
# One-time per-clone setup: point git at the committed team hooks.
# Usage: sh .githooks/../setup-git-hooks.sh   (or via your bootstrap/Makefile)

set -e
cd "$(git rev-parse --show-toplevel)"

if [ ! -d .githooks ]; then
  echo "✗ .githooks/ not found — copy the team githooks/ templates to .githooks/ first" >&2
  exit 1
fi

chmod +x .githooks/*
git config core.hooksPath .githooks
echo "✓ git hooks installed (core.hooksPath → .githooks)"

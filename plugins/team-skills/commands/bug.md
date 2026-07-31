---
description: Fix a bug end-to-end with the team workflow (failing repro test → TDD fix → review → gated commit → push → PR)
argument-hint: [bug report or issue number]
---

Run the `bug-ticket` skill for this bug:

$ARGUMENTS

Reproduce it with a failing test before writing any fix. The commit, push, and
PR stages require my explicit approval — do not auto-approve them.

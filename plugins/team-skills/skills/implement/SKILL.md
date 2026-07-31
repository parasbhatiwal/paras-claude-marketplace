---
name: implement
description: Use this skill whenever writing or changing production code for a task chunk. Enforces strict TDD — write a failing test first (red), write the minimal code to pass (green), then refactor. No production code may be written without a failing test that demands it.
---

# Implement (TDD)

Every code change follows red → green → refactor. This is mandatory, not a
preference: commits that add source code without tests are rejected by the
team's git hooks and CI, so skipping TDD only creates rework.

## Before starting

1. Identify the single chunk being implemented (from `brainstorm` output or the
   user's request). One chunk per cycle — do not batch.
2. Discover the project's test setup via the `run-tests` skill — it detects
   the toolchain rather than assuming one.
   **If the project has no test runner, STOP** and tell the user the project
   needs its testing bootstrap first — the team template is
   `../../references/testing-bootstrap.md` (relative to this skill's
   directory). Do not write untested code as a workaround.
3. Find existing test files near the code being changed and match their
   conventions (file location, naming, helpers, setup patterns).

## The cycle

### Red
- Write ONE focused test that describes the next bit of behavior.
- Run it and **confirm it fails for the right reason** (assertion failure on
  the missing behavior — not an import error or typo). A test that passes
  immediately proves nothing; fix the test.

### Green
- Write the **minimal** production code to make that test pass. Resist
  implementing ahead of the tests.
- Run the test → confirm it passes. Run the full suite → confirm nothing else
  broke.

### Refactor
- With everything green, clean up: remove duplication, improve names, simplify.
- Run the full suite again after refactoring. Green is the invariant.

Repeat the cycle until the chunk's behavior is fully covered, including the
important edge cases (empty input, error paths, boundaries).

## Rules

- The code you write must satisfy the `engineering-principles` skill — the
  non-negotiables there (boundaries, validation at the edge, per-object
  authorization, typed errors, no swallowed failures, honest naming) apply to
  every green step, not just to review.
- Never write production code without a failing test demanding it.
- Never weaken, delete, or `skip` an existing test to get to green — if a test
  is genuinely wrong, say so explicitly and fix it deliberately with the user
  aware.
- Never mock the thing under test; mock only true externals (network, clock,
  fs) and prefer real implementations where cheap.
- Test behavior, not implementation details — tests should survive refactors.
- If mid-cycle you discover the chunk is too big, stop and split it; don't
  push through with a sprawling test.

## Done means

- All new behavior is expressed in tests that were seen failing first.
- Full suite green, lint and typecheck clean.
- Hand off to `review-changes` (never straight to commit).

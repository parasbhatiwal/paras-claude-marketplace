---
name: implement
description: Use this skill whenever writing or changing production code for a task chunk. Enforces strict TDD — write a failing test first (red), write the minimal code to pass (green), then refactor. No production code may be written without a failing test that demands it.
---

# Implement (TDD)

Adapted in part from Matt Pocock's TDD skill (MIT; see
`THIRD_PARTY_NOTICES.md`). Read `GLOSSARY.md` (if present) so test names and
interface vocabulary match the domain, and respect ADRs in the area.

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

## Seams: where tests go

A **seam** is the public boundary you test at — where behavior is observable
without reaching inside (see `codebase-design`). Tests live at seams, never
against internals. **Test only at pre-agreed seams**: they come from the
ticket's *Test seams* (settled in the grill). Attended with none agreed: name
the proposed seams, with a line each on what they catch and what they miss,
and confirm before writing a test. Unattended with none stated: choose the
highest seam that reaches the behavior, and record the choice under *Decisions
the agent made* in the PR — never write a test at an unconfirmed seam silently.

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
- **Vertical slices, not horizontal.** One test → one implementation →
  repeat, each test a tracer bullet that responds to what the last cycle
  taught you. Writing all tests first, then all code, tests *imagined*
  behavior and the shape of things.
- **No tautological tests.** An assertion that recomputes the expected value
  the way the code does (`expect(add(a,b)).toBe(a+b)`) passes by
  construction. Expected values come from an independent source: a literal, a
  worked example, the spec.
- **Verify through the interface.** `createUser` is tested by retrieving the
  user through the public interface, not by querying the database behind it.
  Tests that break on a refactor that changed no behavior are
  implementation-coupled.
- **Mock only at system boundaries** — external APIs, time/randomness, the
  filesystem or database when a real one is not cheap. Never your own modules.
  Design for it: inject dependencies, prefer SDK-style per-operation
  interfaces over one generic fetcher.
- If mid-cycle you discover the chunk is too big, stop and split it; don't
  push through with a sprawling test.

## Done means

- All new behavior is expressed in tests that were seen failing first.
- Full suite green, lint and typecheck clean.
- Hand off to `review-changes` (never straight to commit).

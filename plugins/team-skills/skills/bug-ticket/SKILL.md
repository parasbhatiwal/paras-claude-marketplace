---
name: bug-ticket
description: Use this skill when the user hands over a bug to fix end-to-end ("fix this bug", "production issue", "this is broken"). Orchestrates the team bug workflow - diagnose with a failing repro test, TDD fix, review, gated commit, push, and PR - by running the atomic team skills in sequence with hard gates between stages.
---

# Bug Ticket (orchestrator)

Drive a bug from report to PR by running the team's atomic skills IN ORDER.
The defining rule: **the bug must be reproduced by a failing test before any
fix is attempted.**

## The ticket

The "ticket" is the bug the user reports. If it maps to a GitHub Issue, note
the number — `open-pr` will link it (`Closes #n`). No issue → proceed from the
report.

## Stage 0 — Branch

Create `fix/<slug>` from the up-to-date default branch.

The fix must treat the cause, not the symptom — see the no-patchwork doctrine
in the `engineering-principles` skill. A defensive check added where an
invariant belongs is not a fix.

## Stage 1 — Diagnose

Run the `diagnose` skill. Output: a RED repro test + root-cause statement +
blast radius + sibling occurrences.
**Gate:** no fix code until the repro test exists and fails for the right
reason. If diagnosis shows the "bug" is actually intended behavior or a
requirements gap, stop and discuss with the user instead of "fixing".

## Stage 2 — Fix (implement)

Run the `implement` skill with the repro test as the red of its first cycle:
minimal change to turn it green without breaking the suite. If diagnosis found
sibling occurrences, fix each the same way — its own failing test first.
**Gate:** repro test green, full suite green.

## Stage 3 — Review

Run the `review-changes` skill on the diff. Pay extra attention to blast
radius — a bug fix that changes shared code gets the security routing check.
**Gate:** confirmed findings fixed, suite green.

## Stage 4 — Commit

If the root cause reveals something `CLAUDE.md` states wrong or omits — a
gotcha this bug *was*, a convention nobody wrote down — refresh it via
`project-context` before committing, so the fix and the corrected description
land together. Most bug fixes touch nothing `project-context` would write
differently; do not refresh reflexively, only when the diagnosis actually
found one.

Then run the `commit-changes` skill (full gates, **asks the user first**).
Message type is `fix(scope):`; the body states root cause in one line.

## Stage 5 — Push

Run the `push-branch` skill (**asks first**).

## Stage 6 — PR

Run the `open-pr` skill (**asks first**). The PR body's Summary must include
the root cause, and Testing must name the repro test.

## Wrap-up

Report: branch, root cause, repro test, commits, PR URL. Note any follow-ups
(e.g. broader refactor the fix exposed) as candidates for a separate ticket —
do not scope-creep the fix.

## Hard rules

- No fix without a failing repro test first. No exceptions.
- Minimal fix over opportunistic refactor — keep the diff reviewable.
- A failed gate never falls through; the three ask-gates are user decisions.

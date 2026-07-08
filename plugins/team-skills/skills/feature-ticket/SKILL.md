---
name: feature-ticket
description: Use this skill when the user hands over a feature to build end-to-end ("build feature X", "implement this ticket", "new feature"). Orchestrates the full team workflow - brainstorm, TDD implementation per chunk, review, gated commit, push, and PR - by running the atomic team skills in sequence with hard gates between stages.
---

# Feature Ticket (orchestrator)

Drive a feature from idea to PR by running the team's atomic skills IN ORDER.
This skill sequences; the child skills do the work. Never skip a stage, never
reorder, never inline a stage's logic instead of invoking its skill.

## The ticket

The "ticket" is the task the user hands over. If the repo uses GitHub Issues
and the task maps to one, note the issue number now — `open-pr` will link it
(`Closes #n`). No issue → proceed from the described task; do not invent one.

## Stage 0 — Branch

Create `feat/<slug>` from the up-to-date default branch (slug from the ticket,
kebab-case, short). All work happens on this branch.

## Stage 1 — Brainstorm

Run the `brainstorm` skill. Output: chosen approach + ordered chunk list.
**Gate:** if the approach materially affects the user (API shape, UX, cost),
get their confirmation before any code.

## Stage 2 — Implement (loop per chunk)

For EACH chunk from the brainstorm, in order, run the `implement` skill
(strict TDD: red → green → refactor). Finish a chunk completely — suite green —
before starting the next.
**Gate:** full suite green after every chunk (`run-tests`). A red suite stops
the loop; fix before proceeding.

## Stage 3 — Review

Run the `review-changes` skill once over the whole working diff.
**Gate:** all confirmed correctness findings fixed and suite green again.
Judgment-call findings: surfaced to the user, decided, recorded.

## Stage 4 — Commit

Run the `commit-changes` skill. It runs the full gate matrix and **asks the
user before committing** — that ask is mandatory, even inside this flow.
Prefer one commit per logical change; if chunks are separable, offer split
commits.

## Stage 5 — Push

Run the `push-branch` skill. It re-verifies green and **asks before pushing**.

## Stage 6 — PR

Run the `open-pr` skill. It builds the body (with the mandatory Human
verification section) and **asks before creating the PR**.

## Wrap-up

Report: branch, commits, PR URL, chunk list delivered, anything deferred.
Remind the user the Human-verification checklist in the PR is theirs to
complete before requesting review.

## Hard rules

- A failed gate NEVER falls through to the next stage. Fix or stop and ask.
- The three ask-gates (commit / push / PR) are user decisions — this
  orchestrator never auto-approves them.
- If the user interrupts with a scope change, return to Stage 1 for the new
  scope rather than patching mid-flow.

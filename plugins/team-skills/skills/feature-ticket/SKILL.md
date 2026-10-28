---
name: feature-ticket
description: Use this skill when the user hands over a feature to build end-to-end ("build feature X", "implement this ticket", "new feature"). Orchestrates the full team workflow - brainstorm, TDD implementation per chunk, review, gated commit, push, and PR - by running the atomic team skills in sequence with hard gates between stages.
---

# Feature Ticket (orchestrator)

> **v2:** work handed to an agent starts with the `work` skill (intake → grill
> → handoff → `deliver`). This skill remains the **attended, single-session**
> path for when the human is present for the whole build.

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

If the repo has no `CLAUDE.md` (or the session's context check flagged it as
stale), run `project-context` first — every later stage is better with it.
The standards for every stage below come from `engineering-principles`.

## Stage 1 — Brainstorm

Run the `brainstorm` skill. Output: chosen approach + ordered chunk list.
**Gate:** if the approach materially affects the user (API shape, UX, cost),
get their confirmation before any code.

If the feature touches auth, payments, PII, file handling, multi-tenancy, a
public API, or a new integration, run the `threat-model` skill here — its
mitigations become chunks with their own failing tests. If the approach
settles a decision that is expensive to reverse, record it with the `adr`
skill before implementing.

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

**Manual test offer (local sessions only).** If the change has a web UI and
`printenv TEAM_AUTONOMOUS` is not `1`, ask the user one yes/no question:
*"Want me to test this manually in Chrome before it goes up?"* Yes → run the
`browser-verify` skill on this branch against the ticket's acceptance
criteria; a FAIL goes back through Stage 2 before moving on. No → carry on and
do not ask again. No web UI → do not ask.

## Stage 4 — Commit

**Refresh `CLAUDE.md` first, in the same change.** A feature just made
something about the project untrue — a new command, a new module, a new
convention, a gotcha found the hard way while building it. Run
`project-context` in refresh mode before `commit-changes`, so the description
of the feature ships in the same commit as the feature, not as an
afterthought discovered later by a stale-context hook or the next confused
session. Skip only if this feature genuinely changed nothing `project-context`
would write differently — say so rather than skipping silently.

Then run the `commit-changes` skill. It runs the full gate matrix and **asks
the user before committing** — that ask is mandatory, even inside this flow.
Prefer one commit per logical change; if chunks are separable, offer split
commits.

## Stage 5 — Push

Run the `push-branch` skill. It re-verifies green and **asks before pushing**.

## Stage 6 — PR

Run the `open-pr` skill. It builds the body (with the mandatory Human
verification section) and **asks before creating the PR**.

## Wrap-up

Consider `principles-audit`'s triggers (feature count since the last audit,
growth in `.claude/engineering-overrides.md`, a structural change this feature
just made) and mention it to the user if one applies — a suggestion, not a
gate.

Report: branch, commits, PR URL, chunk list delivered, anything deferred.
Remind the user the Human-verification checklist in the PR is theirs to
complete before requesting review.

## Hard rules

- A failed gate NEVER falls through to the next stage. Fix or stop and ask.
- The three ask-gates (commit / push / PR) are user decisions — this
  orchestrator never auto-approves them.
- If the user interrupts with a scope change, return to Stage 1 for the new
  scope rather than patching mid-flow.

---
name: deliver
description: Use this skill to implement ready-for-agent tickets with no human involvement, usually in the cloud - one integration branch from main for the whole feature, one branch and PR per subtask merged into it, TDD and review per subtask, and a single final PR to main. Invoked with an epic or issue number after the handoff gate has run.
---

# Deliver

Adapted from Matt Pocock's spec-implementation skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

The tickets are a **task graph**, not a list of steps. The goal is the whole
feature on one **integration branch**, ending in **one PR to the default
branch** — the single point where a human looks.

Autonomy rules (what is auto-approved, what the hooks block, the stuck rule):
`../../references/autonomous-mode.md`. Read it first. Ticket briefs are
the contract; read `CLAUDE.md` and the epic spec as context pointers —
subagent messages carry pointers, not copies of what the tracker already says.

## Stage 0 — Preflight

- `printenv TEAM_AUTONOMOUS`. If `1`, you are autonomous: nobody will answer.
  If unset, you are attended: the approval gates of `commit-changes`,
  `push-branch` and `open-pr` apply as normal.
- Read the epic (or single issue), all sub-issues, labels, and blocking edges.
  Only `ready-for-agent` tickets are in scope; anything else is left alone.
- No ready tickets with open frontier → report why and stop. Do not invent work.

## Stage 1 — Integration branch

From an up-to-date default branch:

```sh
git fetch origin && git checkout -b feat/<epic#>-<slug> origin/<default>
git push -u origin feat/<epic#>-<slug>
```

Git cannot hold both `feat/12-x` and `feat/12-x/anything`, so subtask
branches use a `--t` suffix, never a path segment.

Add `agent-working` to the epic. Open a **draft PR** to the default branch
after the first subtask merges (a branch with no commits ahead cannot open
one), body `Closes #<epic>` and each ticket.

## Stage 2 — Work the frontier

Loop until the frontier is empty:

1. **Frontier** = open `ready-for-agent` sub-issues without `agent-working`
   whose blockers are all closed. Claim each (add `agent-working`, re-read to
   confirm the claim won).
2. **Implementer subagents**, in the background, one per ticket, each in its
   own worktree on `feat/<epic#>-<slug>--t<sub#>` cut from the integration
   branch tip. Each implementer:
   - confirms its base is the integration branch, resetting onto it if not;
   - reads its brief; runs the `implement` skill (strict TDD, from the brief's
     acceptance criteria and test seams);
   - runs the `run-tests` skill and the `review-changes` skill over its diff;
   - commits via `commit-changes` (gates run; no ask when autonomous), pushes,
     merges the integration tip into its branch and re-runs tests;
   - opens a PR with **base = integration branch**, `Closes #<sub>`, via
     `open-pr`.
3. **Merger**: once CI is green on a subtask PR, merge it into the integration
   branch (`gh pr merge --merge`). Red CI → the implementer fixes the cause;
   never merge red, never bypass.
4. A merge unlocks blocked tickets → recompute the frontier and start them.
   Remove `agent-working` from the closed subtask.

Independent tickets run concurrently; keep to a small number of live
implementers (roughly 3) so merge conflicts stay cheap.

### Stuck rule

A question the brief does not answer is **never guessed**. The implementer
stops, and the orchestrator: adds `needs-info` to that ticket, comments the
exact question and what was tried, removes `agent-working`, leaves the
branch pushed for context, and skips the ticket and everything it blocks.
Continue with the rest. A failing gate that cannot be fixed at its cause
after real effort is the same: report it, do not weaken the gate.

Drift a brief's *non-blocking assumption* would turn out wrong about is not
stuck — build to the assumption as written, and list it in the final PR.

## Stage 3 — Finish

When the frontier is empty (everything done, or only stuck/blocked tickets
remain):

1. Full suite, lint, typecheck on the integration branch (`run-tests`).
2. `review-changes` over the whole integration diff; fix every confirmed
   finding in one implementer. Judgment-call findings go in the PR body under
   *Decisions for the reviewer*, not silently decided.
3. Apply the grill's deliverables: `GLOSSARY.md` terms, ADRs (`adr` skill).
4. Refresh `CLAUDE.md` with `project-context` in this same change.
5. Push; mark the draft PR **ready** (or create it with `open-pr`). Body: the
   team PR structure plus:
   - **Delivered** — tickets closed, one line each
   - **Decisions the agent made** — assumptions used, judgment calls,
     anything that departed from the brief and why
   - **Environment friction** — what slowed the run that a `retro` would fix
   - **Not delivered** — stuck or blocked tickets with the issue links and
     the exact question each is waiting on
   - **Human verification** — the mandatory checklist; unticked
6. **Stop.** Never merge this PR. Never push the default branch. The hooks
   block both; do not look for a way around a block.
7. Comment the PR link on the epic; remove `agent-working`. Clean up every
   subtask worktree and, once their PRs are merged, their remote branches.

## Report

Integration branch, PR URL, tickets delivered / not delivered, assumptions
used, business issues still open.

## Hard rules

- All subtask PRs target the integration branch. Exactly one PR targets the
  default branch.
- A failed gate never falls through. Fix the cause or mark the ticket stuck.
- Anything a human decided in the grill is settled; do not reopen it.
- Same TDD, review, quality and security standards as attended work — there
  is no lower bar because nobody is watching.

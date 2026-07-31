---
name: principles-audit
description: Use this skill to assess an EXISTING codebase against the team's engineering standards and produce a prioritized, phased remediation plan ("audit this project", "how good is this code", "bring this repo up to standard", "tech debt plan"). Read-only - it gathers evidence, scores each area, and writes a sequenced plan of tickets; it never changes code.
---

# Principles Audit (existing project)

Assess what is actually there, against the `engineering-principles` skill, and
hand back a plan a team can execute incrementally without stopping delivery.

Works on any codebase in any language — detect the stack and its tooling via
`../../references/toolchains.md` (relative to this skill's directory) rather
than assuming an ecosystem.

**This skill is read-only.** It produces a document, not a diff. Fixes happen
later through `feature-ticket` / `bug-ticket`, one ticket at a time.

## Stage 1 — Inventory (facts before opinions)

Establish the ground truth, and state anything you could not determine:

- **Stack**: languages, frameworks, package managers, datastores, runtime
  targets, deploy mechanism.
- **Size and shape**: file/LOC counts by area, largest files, directory
  structure, entry points (`main`, route registrations, job schedulers).
- **Test reality**: does a runner exist, does the suite pass *right now*, how
  long does it take, what is the actual coverage? Run it — do not read the
  badge.
- **Toolchain**: linter, formatter, typechecker — present? strict? passing?
- **CI/CD**: what runs, what actually gates a merge, what is advisory.
- **Dependency health**: outdated/EOL packages, known CVEs, unmaintained or
  duplicated libraries, lockfile present and honored.
- **Churn map**: `git log --format= --name-only --since=1.year | sort |
  uniq -c | sort -rn | head -40`. Files that change constantly are where
  quality problems cost the most — this drives prioritization later.
- **Ownership**: CODEOWNERS, branch protection, who reviews.

## Stage 2 — Evidence per area

Walk each area of `engineering-principles` and collect **specific, cited**
findings (`file:line` + what is wrong + why it matters). No vague verdicts —
"poor separation of concerns" is not a finding; "`api/orders.ts:88` builds SQL
by string concatenation from `req.query.sort`" is.

Look for, at minimum:

| Area | Probes |
|---|---|
| Boundaries | framework/ORM/HTTP imports inside domain logic; cross-context reach-ins; god modules; circular imports |
| Design | duplicated business rules; `switch` chains on type tags; primitive obsession; functions > 100 lines; files > 400 lines; dead code |
| Errors | swallowed exceptions (`catch {}`), error strings compared by text, generic 500s, no taxonomy |
| Security | the A01–A10 probes in the `engineering-principles` security reference — start with authorization checks, raw SQL, unvalidated input, secrets in repo/history, dependency CVEs |
| Testing | untested modules ranked by churn × risk; mocked-under-test; skipped/flaky tests; assertions that cannot fail |
| Data | missing constraints/indexes, N+1 patterns, unsafe migrations, dual writes, unbounded queries |
| Operability | missing timeouts on outbound calls, unstructured logs, no correlation id, no health checks, no metrics, config read ad hoc |
| API | leaked internal models, breaking changes without versioning, inconsistent error shapes, offset pagination on large sets |
| Quality attrs | strictness disabled, `any`/`ignore` counts, a11y violations, bundle size, missing perf budgets |

Use the codebase's own history as evidence: recurring bug fixes in one module
say more than any static read.

## Stage 3 — Score each area

Rate each area 0–4 and justify the number in one line with a cited example:

```
0 absent      — nothing there
1 ad hoc      — exists in places, inconsistent, no enforcement
2 defined     — a convention exists, unevenly followed
3 enforced    — automated (lint/CI/hooks), rarely violated
4 optimized   — enforced AND measured, with feedback loops
```

Present as a table. The score's job is to make the gap legible to
non-engineers and to give the team a way to measure progress later.

## Stage 4 — Prioritize honestly

Rank findings by **impact × likelihood × churn**, not by how offensive they
are to read:

- **P0 — bleeding**: exploitable security holes, data-loss/corruption risks,
  correctness bugs in money or auth paths. Fix now, out of band.
- **P1 — structural risk**: no tests around high-churn critical code, missing
  boundaries that make every change dangerous, absent CI gates.
- **P2 — friction**: duplication, weak typing, poor naming, slow suite.
- **P3 — polish**: cosmetic consistency, minor idiom drift.

A beautiful refactor of code nobody touches is P3, however tempting. Say that
plainly.

## Stage 5 — The plan (the actual deliverable)

Write `docs/engineering-remediation-plan.md`, phased so that **each phase
ships independently and leaves the codebase better than it found it**:

- **Phase 0 — Make change safe** (days). Test runner + CI + hooks + secret
  scanning; characterization tests over the highest-churn critical paths.
  Nothing else can be done safely first. The team's runner template is
  `../../references/testing-bootstrap.md` (relative to this skill's directory).
- **Phase 1 — Stop the bleeding** (days–weeks). Every P0, each as its own
  `bug-ticket` with a failing test that proves the hole.
- **Phase 2 — Establish boundaries** (weeks). Introduce the target structure
  by **strangler fig**: create the new boundary, route new work through it,
  migrate callers incrementally. Never a big-bang rewrite; never a branch that
  lives for months.
- **Phase 3 — Pay down by churn** (ongoing). Apply the boy-scout rule with a
  budget: an agreed share of each sprint, targeting the churn map. Retire the
  duplication and typing debt where the code is actually touched.
- **Phase 4 — Raise the floor** (ongoing). Turn each convention into an
  automated gate as compliance reaches it, via the `project-rules` skill —
  strict typing, boundary lint, coverage ratchet, CVE gate — each ratcheted
  with a shrinking allowlist rather than switched on across 400 files. A rule
  not enforced by CI decays.

For every item in every phase:

```
### <id> <title>            (P1 · effort M · risk low)
Problem: <one line, with file:line evidence>
Change:  <what will be different afterwards>
Done when: <verifiable acceptance criteria>
Run with: feature-ticket | bug-ticket
Depends on: <ids>
```

End the document with: the score table, a one-paragraph executive summary a
non-engineer can act on, and the three things to start on Monday.

## Rules

- **Read-only.** No edits, no "quick fixes along the way", no reformatting.
  The single artifact is the plan document.
- Evidence or it does not go in the report. Every claim carries a citation.
- Sequence over volume: 200 findings nobody can act on is a worse outcome than
  20 that get done. Cap each phase at what a team can actually absorb.
- Never propose a rewrite as the default. Rewrites lose behavior nobody
  documented; strangler-fig migration is the default answer.
- Never mix a refactor with a behavior change in the same ticket — that is how
  regressions become untraceable.
- Respect what is good. Say what the codebase does well; a report that is
  only criticism gets dismissed, and the strengths tell you which patterns to
  spread.
- If the project has no tests at all, Phase 0 is non-negotiable and every
  other phase depends on it.

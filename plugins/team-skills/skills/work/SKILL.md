---
name: work
description: Use this skill when the user hands over ANY piece of work - a GitHub issue number or URL, a feature request, a bug report, or a plain requirement ("build X", "fix Y", "implement #42", "here is a ticket"). The v2 entry point - intake, then exhaustive grilling, then a readiness gate, after which an agent can deliver with no human involved.
---

# Work (v2 orchestrator)

```
INTAKE ─► GRILL (the last human touchpoint) ─► HANDOFF GATE ─► DELIVER ─► one PR to main
```

This skill sequences; the child skills do the work. Everything before the
handoff gate is **attended** — the human answers questions. Everything after it
is built to run **without** them, usually in the cloud. That asymmetry is the
design: the grill must be exhaustive precisely because nobody can be asked
afterwards.

Labels and states: `../../references/workflow-labels.md`. GitHub operations:
`../../references/issue-tracker-github.md`.

Unsure whether this is the right flow? The `route` skill picks one. Bigger
than one session, or foggy? `wayfinder` first. Issues you did not write,
piling up? `triage`.

## Stage 0 — Preconditions

- `gh auth status` must pass and the repo must have a GitHub remote. If not,
  say so and stop; this workflow lives in GitHub issues.
- No `CLAUDE.md`, or the session flagged it stale → run `project-context` first.
  The grill and the agent both read it.
- Ensure the workflow labels exist (create missing ones).

## Stage 1 — Intake

Run the `intake` skill. Output: one GitHub issue number, labelled with a
category and `needs-triage`.

## Stage 2 — Grill

Run the `grill` skill on that issue. It interviews the human until the design
tree is exhausted, raises separate issues for business questions, runs
`threat-model` / `adr` / prototypes where warranted, and records every
decision. **Do not shortcut it for a task that looks small** — a small task
with a hidden assumption is the one that comes back wrong from the cloud.

## Stage 3 — Spec and tickets

Run the `spec-and-tickets` skill. Output: a spec on the epic issue, and
vertical-slice sub-issues with blocking edges, approved by the human. A task
that is genuinely one slice stays a single issue (no epic).

## Stage 4 — Handoff gate

Run the `handoff-gate` skill. It tests every ticket against "could an agent
finish this with zero questions?", writes the agent briefs, and applies
`ready-for-agent` / `ready-for-human` / `needs-info`.

**Gate:** nothing is `ready-for-agent` without a passing gate and a brief.

## Stage 5 — Hand over

Tell the human exactly what happens next and let them choose:

1. **Cloud (the intended path):** the tickets are `ready-for-agent`; a cloud
   run (`../../references/autonomous-mode.md`) picks them up. Nothing more to
   do here. Report the epic link and the list of open business-input issues.
2. **Here, now (attended):** run `deliver` in this session. Approval gates
   still apply because `TEAM_AUTONOMOUS` is not set.

Never start `deliver` in this session without that choice.

## After delivery

When the cloud run (or local `deliver`) ends and the human has reviewed the
PR, run the `retro` skill over it if the run was rough: friction becomes
checks, standards and navigation pointers, so the next run starts better.

## Hard rules

- A gate failure never falls through. Fix it or stop and ask.
- The human is asked questions in Stages 2–3 and only there. If a question
  occurs to you in Stage 4 or later, the grill was incomplete: go back to
  Stage 2 for that question.
- Do not write production code in this skill or any of its first four stages.

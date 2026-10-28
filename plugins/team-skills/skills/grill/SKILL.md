---
name: grill
description: Use this skill to interview the human about a GitHub issue until every decision is settled - the exhaustive, final human touchpoint before autonomous delivery. Walks the design tree in rounds with recommended answers, sharpens the glossary, runs threat-model and adr where warranted, splits business questions into their own issues, and records every decision on the issue.
---

# Grill

Adapted from Matt Pocock's `grilling` and `domain-modeling` skills (MIT; see
`THIRD_PARTY_NOTICES.md`).

This is **the last time a human is available**. After the handoff gate, an
agent builds this in the cloud with nobody to ask. Every question you do not
ask now becomes a guess later — and a guess made at 3 a.m. with no reviewer
is the failure this whole workflow exists to prevent. Be relentless. Err
toward asking.

## Inputs

An issue labelled `needs-triage` (from `intake`). Read it, its comments, and
prior triage notes first.

## Step 1 — Look things up before asking anything

Finding **facts** is your job, never the human's. Explore the codebase
(dispatch sub-agents for broad searches), `CLAUDE.md`, `GLOSSARY.md`,
`docs/adr/`, existing tests, and prior art. Check whether it already exists.
Only **decisions** go to the human.

- **Bug:** run the `diagnose` skill now. A confirmed reproduction (failing
  test, or exact steps and the code path) is part of what the brief carries. A
  bug that cannot be reproduced goes to `needs-info` with what was tried.
- **Feature:** note existing seams, utilities and patterns the build should
  reuse.

## Step 2 — Walk the design tree, in rounds

Every decision branches into decisions that hang off it. The **frontier** is
every decision whose prerequisites are already settled. Each round, ask the
whole frontier at once:

```
❓ **Q1** - **<title>**: <question; multiple choice where it helps>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommendation. A question depending
on another still open in this round belongs to the next round. Wait for the
answers, recompute the frontier, ask again. Continue until the frontier is
empty.

### What the tree must cover (checklist, not suggestion)

Walk every item; each is either answered, explicitly not applicable, or a
business question (Step 3).

- **Behavior:** happy path, every failure mode, empty/duplicate/concurrent
  cases, what the user sees when it fails.
- **Who and what:** actors, permissions, tenancy, data ownership.
- **Contracts:** API shapes, schema changes, events, backwards compatibility,
  migrations and rollback.
- **Non-functional:** performance targets, limits, scale, cost, accessibility,
  i18n, observability, feature flags / rollout.
- **Security:** if it touches auth, payments, PII, files, multi-tenancy, a
  public API or an integration → run `threat-model` now; each mitigation
  becomes a requirement the human has confirmed.
- **Dependencies:** services, credentials, environments, third-party accounts
  the cloud runner will or will not have. Anything it lacks is a human task.
- **UI:** if there is a UI, what it looks like and does — prototype it
  (a throwaway page or script) when words are not enough.
- **Testing:** the seams where behavior is verified (prefer one, at the
  highest level that works), prior art, what must never be mocked.
- **Scope:** what is explicitly out; what is deferred.
- **Done:** how a human will verify the result in the final PR.

## Step 3 — Business questions

Some questions only the business can answer (pricing rules, legal copy,
policy, priorities). Do not hold the whole task hostage to them.

For each, decide **blocking vs non-blocking**:

- **Non-blocking** — a sensible default exists *and* changing it later is
  cheap (a constant, a config flag, copy). Record the default as an
  **assumption** in the brief, build it so the change is local.
- **Blocking** — no safe default, or a wrong guess is expensive or
  irreversible (data shape, money movement, legal commitment). The subtree
  that depends on it cannot be built.

Create **one separate issue per business question** labelled
`needs-business-input`: the question, why it matters, options with a
recommendation, who might answer, and which tickets it affects. Link it from
the parent. A blocking one becomes a blocking edge on the affected tickets;
unrelated tickets proceed. Tell the human the list at the end of the grill.

## Step 4 — Sharpen the language as you go

- A term that conflicts with `GLOSSARY.md`: call it out immediately.
- A fuzzy or overloaded term ("account"): propose the precise one.
- Stress-test relationships with concrete edge-case scenarios.
- When the human states how something works, check the code agrees; surface
  contradictions.
- Write each resolved term to `GLOSSARY.md` the moment it is resolved (a
  glossary only — no implementation detail; create it lazily).
- Offer an ADR (run the `adr` skill) only when the decision is hard to
  reverse, surprising without context, and a real trade-off. All three.

Glossary and ADR edits are made on the feature branch by `deliver`, not now —
write them into the brief as a ticket's deliverable. (This stage changes
issues, not code.)

## Step 5 — Record and confirm

Do not act until the human confirms shared understanding. Then:

1. Post a **Decision log** comment on the issue: every settled decision, every
   assumption (with its business issue), every out-of-scope item. Durable
   prose, no file paths.
2. Summarize in the chat: decisions count, assumptions, business issues
   raised, what remains blocking.
3. Hand off to `spec-and-tickets`.

## Rules

- Never ask the human for something you could look up.
- Never resolve a decision-changing ambiguity with a silent guess. Unanswered
  non-business questions are not "assumptions" — they are unfinished grilling.
- The session is done when the frontier is empty, not when the human gets
  tired. If they want to stop early, say what remains unasked and label the
  issue `needs-info` rather than `ready-for-agent`.

---
name: spec-and-tickets
description: Use this skill after grilling to turn the settled decisions into a spec on the epic issue and a set of vertical-slice sub-issues with native blocking edges, each small enough for one agent context window. The human approves the breakdown before anything is published. Does not interview; synthesizes.
---

# Spec and tickets

Adapted from Matt Pocock's `to-spec` and `to-tickets` skills (MIT; see
`THIRD_PARTY_NOTICES.md`). This skill synthesizes the grill's decision log; it
does not re-interview. A gap it discovers means the grill was incomplete —
return to `grill` for that question.

## Step 1 — Seams

Sketch where the feature will be tested. Prefer existing seams; use the
highest seam that works; the ideal count is one. Confirm with the human —
this is the one question this stage may ask.

## Step 2 — Decide: single issue or epic

If the work is one vertical slice that fits one agent context, **keep the
original issue**; its spec is the agent brief. No epic. Otherwise continue.

## Step 3 — Write the spec on the epic

The original issue becomes the **epic** (`epic` label). Edit its body, or post
a comment, with:

- **Problem Statement** (user's perspective)
- **Solution** (user's perspective)
- **User Stories** — long, numbered, `As an <actor>, I want <feature>, so that
  <benefit>`, covering all aspects
- **Implementation Decisions** — modules, interfaces, schema, API contracts,
  security mitigations, glossary/ADR deliverables. No file paths or code
  snippets (they rot); except a prototype-derived snippet that encodes a
  decision more precisely than prose
- **Testing Decisions** — what a good test is here, which modules, prior art
- **Out of Scope**
- **Assumptions** — each linked to its `needs-business-input` issue
- **Further Notes**

## Step 4 — Slice into tickets

Tracer-bullet vertical slices:

- Each cuts a narrow but COMPLETE path through every layer (schema, API, UI,
  tests); it is demoable or verifiable alone.
- Each fits a single fresh context window.
- Prefactoring goes first ("make the change easy, then make the easy change").
- Wide mechanical refactors are the exception: expand–contract, in batches
  sized by blast radius, never one giant ticket.
- Security mitigations from `threat-model` and glossary/ADR writes are tickets
  or acceptance criteria, not afterthoughts.
- Give each ticket its **blocking edges**. No blocker = can start now.
  Maximize the frontier: only real dependencies are edges.

## Step 5 — Human approval

Present a numbered list: **Title**, **Blocked by**, **What it delivers**. Ask:
granularity right? blocking edges genuine? merge or split anything? Iterate
until approved. Publish nothing before approval.

## Step 6 — Publish

In dependency order (blockers first), create one issue per ticket as a
sub-issue of the epic, with native blocking edges (see
`../../references/issue-tracker-github.md`). Body: Parent, What to build,
Acceptance criteria, Blocked by. Label each `needs-triage` — `handoff-gate`
applies the final state. Do not close or modify the epic beyond the spec.

## Output

Epic number, ticket list with edges, the business-input issues and which
tickets they block. Hand off to `handoff-gate`.

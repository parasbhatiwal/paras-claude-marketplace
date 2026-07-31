---
name: engineering-principles
description: Use this skill whenever designing, writing, reviewing, or refactoring production code on any project. The team's single source of truth for enterprise-grade engineering standards - SOLID, DRY, clean boundaries, OWASP security, operability, API and data design, testing strategy, and quality attributes - plus the no-patchwork doctrine that says fix causes, not symptoms.
---

# Engineering Principles

The standards below apply to **every** project the team touches, greenfield or
inherited. `brainstorm`, `implement`, and `review-changes` all resolve their
"is this good code?" questions here.

This file is the index and the non-negotiables. The depth lives in
`references/` — read the reference for the area you are working in rather than
loading all of them.

| Area | Reference |
|---|---|
| Structure, SOLID, DRY, boundaries, errors | `references/design.md` |
| OWASP, authn/authz, secrets, supply chain | `references/security.md` |
| Config, logging, metrics, resilience, rollout | `references/operability.md` |
| API contracts, schemas, migrations, PII | `references/api-and-data.md` |
| What to test, how, and what not to mock | `references/testing.md` |
| Performance budgets, accessibility, i18n | `references/quality-attributes.md` |

These are language-agnostic by design. Where a rule needs tooling, resolve it
for the project's stack through `../../references/toolchains.md` (relative to
this skill's directory) — never assume an ecosystem. Turning these principles
into gates a machine enforces for one project is the `project-rules` skill.

## The no-patchwork doctrine

The rule the rest of this file serves: **fix causes, not symptoms.**

- Treat the root cause, not the reported surface. A `null` check added where a
  value should never have been null is a patch; making the value impossible to
  construct wrong is a fix.
- If a change does not fit the current design, **change the design** — do not
  wedge the change in. Refactor first (separately, with tests green), then add
  the behavior.
- No special-case branches to make one caller happy. A conditional keyed on a
  specific caller, tenant, or environment is a design smell; model the
  difference explicitly instead.
- No commented-out code, no `TODO` without a ticket reference, no dead flags,
  no "temporary" shims without a removal date and an owner.
- Leave one way to do a thing. Adding a second mechanism beside the existing
  one without deleting the old is how codebases rot.
- Silence is not success: never swallow an error, never `catch {}`, never
  weaken a test or a type (`any`, `# type: ignore`, `@ts-expect-error`) to get
  to green. If a type or test is wrong, fix it deliberately and say so.

Balanced against YAGNI: fixing the cause does **not** mean building the
general case. Solve today's problem completely and correctly with the simplest
design that will not have to be unpicked tomorrow.

## Decision order

When principles pull against each other, resolve in this order:

1. **Correctness** — it does the right thing, provably, under edge cases.
2. **Security & privacy** — it cannot be abused; it leaks nothing.
3. **Clarity** — the next person understands it without archaeology.
4. **Operability** — failures are visible, diagnosable, and recoverable.
5. **Performance** — it meets its budget.

Never trade 1–2 for 5. Optimize only against a measured budget
(`references/quality-attributes.md`), never on instinct.

## Non-negotiables

Every change, on every project:

- **Boundaries hold.** Dependencies point inward: domain logic never imports
  frameworks, HTTP, ORMs, or UI. See `references/design.md`.
- **Validate at the edge, trust inside.** Every external input — request body,
  query param, env var, webhook, file, queue message — is parsed into a typed,
  validated shape at the boundary.
- **Authorize every access, per object.** Authentication is not authorization;
  a route guard is not an object check. See `references/security.md`.
- **No secret ever reaches the repo, a log, or an error message.**
- **Errors are typed and handled deliberately** — a taxonomy, not strings.
  Failures either recover or propagate with context; they never vanish.
- **Every behavior is expressed in a test that was seen failing first**
  (`implement`), and tests assert behavior, not implementation.
- **Public surfaces are contracts.** Changing one is a versioned, deliberate
  act with a migration path.
- **Config comes from the environment**, is validated at startup, and the
  process fails fast when it is wrong.
- **Naming is honest.** A name that lies costs more than a missing comment.
  Match the surrounding code's idiom, tense, and vocabulary.

## Applying this in a cycle

**Before writing code** (during `brainstorm`):
- Which boundary does this belong in? What owns this state?
- What is the contract — inputs, outputs, failure modes?
- What is the trust boundary and what is the threat here?
- What existing code already does part of this? (DRY is a *discovery*
  obligation before it is a deduplication one.)

**While writing** (during `implement`): the non-negotiables above.

**Before commit** (during `review-changes`), the layered check:
- Duplication introduced? Abstraction invented for a single caller?
- Any rule above violated? Any patch where a fix belonged?
- Does the diff read like the rest of the codebase?

## Rules

- These are defaults, not dogma. A deliberate, recorded exception (an ADR —
  see `references/design.md`) is fine; an undiscussed one is not.
- When an existing codebase violates these, do **not** opportunistically
  rewrite it inside an unrelated change. Record it and route it through
  `principles-audit`.
- Consistency with the surrounding code beats consistency with this document
  when the two conflict inside a small change — then fix the surroundings
  separately.

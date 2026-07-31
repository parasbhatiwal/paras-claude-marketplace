---
name: bootstrap-project
description: Use this skill when starting a NEW project from scratch ("new project", "greenfield", "set up a repo", "start building X"). Establishes the architecture, guardrails, and cross-cutting foundations BEFORE any feature code, so the codebase is enterprise-grade from commit one rather than patched into shape later.
---

# Bootstrap Project (greenfield)

The cheapest moment to get architecture, testing, security, and operability
right is before the first feature exists. This skill spends that moment
deliberately.

Standards come from the `engineering-principles` skill — read it first; this
skill is the sequence that puts those standards on the ground, and
`project-rules` is what makes them enforced rather than aspirational.

Works in any language: never assume an ecosystem, resolve tooling through
`../../references/toolchains.md` (relative to this skill's directory).

## Stage 0 — Understand before choosing (do not skip)

Ask the user, and record the answers — they drive every later choice:

- **Domain & users**: what problem, for whom, what does "done" mean?
- **Scale & shape**: expected users/req-per-second/data volume in year 1;
  read-heavy or write-heavy; real-time or batch?
- **Constraints**: languages/clouds the team must use, existing systems to
  integrate, budget, deadline, team size and experience.
- **Compliance & data**: any PII/PHI/PCI, which jurisdictions, retention or
  residency requirements, audit obligations?
- **Interfaces**: web UI, mobile, public API, internal service, CLI, jobs?
- **Availability target**: what does an hour of downtime cost?

If the answers are not known, say so explicitly and choose the *reversible*
option. Never invent requirements to justify infrastructure.

## Stage 1 — Decide the architecture, and write it down

1. Propose 2–3 genuinely distinct architectures sized to the answers above
   (use `brainstorm` for the reasoning). Default to the **simplest thing that
   respects the dependency rule**: a modular monolith with clean boundaries
   beats microservices for almost every new project, and it can be split later
   precisely because the boundaries exist.
2. Name the bounded contexts and the module structure — package by feature,
   not by technical layer (`references/design.md` in `engineering-principles`).
3. Record each significant choice with the `adr` skill **now**: language,
   framework, datastore, deployment target, auth strategy, API style.
4. Confirm with the user before scaffolding — this is the expensive decision.

**Anti-goal:** do not build for imagined scale. Kafka, service meshes, CQRS,
and multi-region are decisions with ongoing cost; each needs a stated reason
in its ADR or it does not go in.

## Stage 2 — Skeleton with boundaries enforced

Lay down the directory structure that encodes the architecture, with one
example of each layer (not a feature — just the shape):

```
src/
  <context>/            # e.g. billing/, identity/
    domain/             # pure: entities, value objects, invariants
    application/        # use cases + ports (interfaces it needs)
    adapters/
      inbound/          # http handlers, cli, consumers
      outbound/         # repositories, clients, publishers
  shared/               # cross-context primitives ONLY (result, ids, errors)
```

Then make the boundary mechanical, not aspirational: add an import-boundary
lint rule (`eslint-plugin-boundaries`, `import-linter`, `depguard`, ArchUnit)
that fails the build when `domain/` imports a framework or a context reaches
into another's internals.

## Stage 3 — Guardrails BEFORE features

Run the `project-rules` skill — it owns this list and makes each item an
enforced gate for **this** project's language(s). No feature code is written
until they are green in CI:

1. **Task interface**: `install`, `format-check`, `lint`, `typecheck`, `test`,
   `test-coverage`, `build`, `security` — via a `Makefile`/`justfile` or the
   ecosystem's conventional entry points. This is what makes the team's hooks
   and CI work regardless of language
   (`../../references/toolchains.md`, relative to this skill's directory).
2. **Test runner + first real passing test** —
   `../../references/testing-bootstrap.md`. A project without a runner cannot
   pass the team's commit gates.
3. **Formatter + strict linter + strict typechecker.** Strict from day one —
   loosening later is easy; tightening later is a project.
4. **Boundary lint rule** encoding the dependency rule from Stage 2, so the
   architecture cannot erode silently.
5. **CI** from `examples/github-workflows/ci.yml`: static checks, tests with
   coverage, diff coverage ≥ 90%, coverage ratchet, dependency and secret
   scanning.
6. **Git hooks** from `examples/githooks/` via `setup-git-hooks.sh`.
7. **Secret hygiene**: `.gitignore` covering `.env*`, a committed
   `.env.example`, and `gitleaks.toml`.
8. **Dependency automation**: Dependabot/Renovate + the CVE gate.
9. **Repo policy**: `CODEOWNERS`, PR template, branch protection requiring the
   CI checks + review, and the `commit-policy` workflow.
10. **`.claude/settings.json`** from `examples/project-settings.json` so
    teammates inherit the team plugin, permissions, and denials.

## Stage 4 — Cross-cutting foundations

Build these once, before features need them — retrofitting each is a
codebase-wide change:

- **Config**: one typed, schema-validated module that reads the environment at
  startup and fails fast listing every problem.
- **Error taxonomy**: the shared error types and the single mapping from
  domain errors to transport responses (`references/design.md`).
- **Structured logging + correlation ids** propagated through context, with
  redaction at the logger.
- **Health endpoints**, graceful shutdown, and a metrics/tracing exporter.
- **Persistence**: migration tool wired into CI, the first migration, and a
  repository port with one real integration test against a containerized DB.
- **AuthN/AuthZ skeleton**: session/token handling from a proven library, plus
  the per-object authorization helper every use case will call. Add the
  denied-case tests with it. Run the `threat-model` skill first if the product
  handles money, PII, or multi-tenancy.
- **HTTP client wrapper** with timeouts, retries with jitter, and tracing —
  so no call site can forget them.

Each of these arrives with tests, via `implement`. No exceptions: the
foundation is exactly the code you cannot afford to be wrong.

## Stage 5 — Context for humans and Claude

Run the `project-context` skill to generate `CLAUDE.md`, and fill
`examples/CLAUDE.md.template`'s architecture and conventions sections from the
ADRs written in Stage 1. Add `README.md` (what it is, how to run it, how to
test it) and `CONTRIBUTING.md` pointing at the team workflow.

## Stage 6 — Walking skeleton

Deliver **one thin vertical slice end-to-end** — inbound adapter → use case →
domain → repository → migration → test at every level — through the
`feature-ticket` skill. A trivial-but-real slice proves the wiring, the CI,
the deploy, and the local developer loop before any complexity lands.

Deploy that slice. A pipeline that has never deployed is not a pipeline.

## Wrap-up

Report: the architecture chosen and why, the ADRs written, the guardrails
green in CI, the foundations built, and the walking slice deployed. List
explicitly what was deliberately **not** built and why, so the next person
does not mistake absence for oversight.

## Hard rules

- No feature code before Stage 3 is green. This is the whole point of the
  skill: guardrails first is what keeps the project from becoming patchwork.
- Every architectural choice is an ADR or it is not a choice, it is an
  accident.
- Choose boring, reversible technology by default; justify anything else.
- Do not scaffold what you cannot explain. Generated code you have not read is
  code nobody owns.

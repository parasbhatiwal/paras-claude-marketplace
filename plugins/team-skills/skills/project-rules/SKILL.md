---
name: project-rules
description: Use this skill to establish or tighten the enforced rules for a specific project ("set up the rules for this repo", "add lint/CI gates", "make our standards enforceable", "why is nothing stopping this"). Translates the team's engineering principles into that project's actual configuration - formatter, linter, strict types, boundary rules, security scanning, coverage gates, hooks, CI, PR policy - and records the rule set with any deliberate exceptions.
---

# Project Rules

The team's standards live in the `engineering-principles` skill. This skill
makes them **true for one project**: config a machine enforces, not prose a
human is supposed to remember.

> A rule a linter enforces is a rule. A rule in a document is a wish.

Works in any language — resolve tooling through `../../references/toolchains.md`
(relative to this skill's directory), never by assuming an ecosystem.

## When to run it

- During `bootstrap-project` Stage 3 (greenfield: the full set, immediately).
- As Phase 4 of a `principles-audit` remediation (existing project:
  incrementally, as each area reaches compliance).
- Any time a rule needs adding, tightening, or a documented exception.

## Stage 1 — Detect and assess

1. Identify the stack(s) and the package/workspace layout — a monorepo gets
   rules per package plus a root entry point.
2. Inventory what already exists: formatter, linter, typechecker, test runner,
   coverage, CI gates, hooks, branch protection, CODEOWNERS, dependency
   automation, secret scanning.
3. For each: is it **absent**, **present but advisory**, or **enforced**? Only
   "fails the build or the commit" counts as enforced.
4. Report the gap before changing anything.

## Stage 2 — The rule set

Establish these, in this order. Each has to be *runnable* and *wired into a
gate*; a config file nothing invokes is not a rule.

### 1. Task interface
Expose `install`, `format-check`, `lint`, `typecheck`, `test`,
`test-coverage`, `build`, `security` — via a `Makefile`/`justfile`, or the
ecosystem's conventional entry points. This is what makes every later gate
language-agnostic. Template: `examples/Makefile.template` in the marketplace.

### 2. Formatting — zero discussion
An opinionated formatter with a committed config and `.editorconfig`.
`format-check` runs in pre-commit and CI. Style must never reach code review.

### 3. Linting — correctness first, style last
Enable the correctness and security rule sets, not just stylistic ones
(e.g. `eslint` + `eslint-plugin-security`, `ruff` with `S`/bugbear,
`golangci-lint` with `gosec`, `clippy -D warnings`, `detekt`, `rubocop`).
**Warnings are failures** — a warning nobody must fix is noise that trains the
team to ignore output.

### 4. Type strictness
Strictest setting the language offers, from day one on greenfield:
`strict: true` + `noUncheckedIndexedAccess`, `mypy --strict`/pyright strict,
`-Werror`, nullability checks on. On existing code, ratchet: enable globally
with a shrinking allowlist of exempted files, and forbid adding to it.

### 5. Boundary enforcement
Encode the dependency rule from the principles as a lint rule so it cannot be
violated silently: `eslint-plugin-boundaries`/`import/no-restricted-paths`,
`import-linter` (Python), `depguard` (Go), ArchUnit (JVM), `cargo-deny`.
At minimum: domain must not import framework/ORM/HTTP; no context may import
another context's internals.

### 6. Test and coverage gates
Test runner present and green; diff coverage ≥ 90% on changed lines; a total
coverage ratchet; the TDD test-presence gate in `commit-msg`. Record the
coverage report path so CI and contributors agree on it.

### 7. Security gates
Dependency vulnerability scan (`security` task) failing on high/critical;
secret scanning pre-commit **and** over history in CI; automated dependency
updates (Dependabot/Renovate); pinned CI actions; least-privilege workflow
permissions (`permissions: contents: read` by default).

### 8. Git and review policy
Committed hooks via `setup-git-hooks.sh`; branch protection requiring the CI
checks and at least one review; `CODEOWNERS` for sensitive paths; the PR
template (`examples/pull_request_template.md`) with the human-verification
section; conventional-commit subjects; both `Co-Authored-By` trailers.

### 9. Claude-facing rules
`.claude/settings.json` from `examples/project-settings.json`: the team
marketplace pinned to `stable`, permission allowlist for the project's real
commands, and denials for `.env`, keys, and secret paths. Plus `CLAUDE.md` via
`project-context`, whose rules section points at this document.

## Stage 3 — Record the decisions

Write `docs/engineering-rules.md`:

```markdown
# Engineering rules — <project>

Standards: the team `engineering-principles` skill. This file records how they
are ENFORCED here and every deliberate deviation.

## Gates
| Rule | Tool | Enforced at | Config |
|---|---|---|---|
| Formatting | ruff format | pre-commit, CI | pyproject.toml |
| …

## Deliberate exceptions
| Rule | Scope | Why | Expires / revisit | ADR |
|---|---|---|---|---|
| mypy strict | legacy/reporting/** | pre-existing, ratcheting down | 2026-12-01 | ADR-0012 |

## Ratchets in progress
<what is currently allowlisted and shrinking, with the target date>
```

Every exception is **scoped, justified, and dated**. An exception without an
expiry is a rule that was quietly deleted.

## Stage 4 — Verify the gates actually bite

Do not claim a rule is enforced until you have seen it fail:

- Introduce a temporary violation locally and confirm the hook/CI rejects it.
- Confirm the CI checks are *required* in branch protection, not merely
  present — an unrequired check is advisory.
- Then revert the violation.

Report which rules were verified this way, and which were only configured.

## Rules for this skill

- **Never weaken an existing gate** to make a build pass. Fix the code, or add
  a scoped, dated exception with a reason.
- **The third occurrence of a bug class becomes a gate.** The first is bad
  luck, the second is a helper with a comment explaining it, and the third
  proves that neither the helper nor the comment is being read. Turn it into a
  lint rule, a grep in CI, or a schema constraint — whatever fails the build.
  A recurring mistake that keeps being fixed by hand is a missing rule, and
  every repetition is evidence somebody's memory is load-bearing.
- Introduce rules to an existing codebase **ratcheted, not big-bang**: enable
  globally, allowlist current violations, forbid additions, shrink over time.
  A rule that fails 400 files on day one gets disabled by day two.
- One rule per change, each verified — this is not a place for a sweeping,
  unreviewable PR.
- Do not invent project-specific standards that contradict
  `engineering-principles`; if the team default is wrong here, record why in
  an ADR (`adr` skill) and reference it in the exceptions table.
- Prefer the ecosystem's standard tool over an exotic one — rules must survive
  the next person and the next contributor.

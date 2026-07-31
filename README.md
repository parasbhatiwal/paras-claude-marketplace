# Paras Claude Marketplace

The team's engineering workflow for Claude Code, authored **here once** and
picked up by every developer and every project that enables it.

It covers how we design, build, review, secure, and ship software — in **any
language** — and it enforces the parts that matter with hooks and CI rather
than with documents nobody re-reads.

---

## Table of contents

- [Quick start](#quick-start)
- [Installation](#installation)
- [The 60-second version](#the-60-second-version)
- [Commands](#commands)
- [Skills](#skills)
  - [Standards](#standards)
  - [Project lifecycle](#project-lifecycle)
  - [The delivery workflow](#the-delivery-workflow)
  - [Maintenance](#maintenance)
- [Enforcement: what actually blocks you](#enforcement-what-actually-blocks-you)
- [Language support](#language-support)
- [Setting up a project](#setting-up-a-project)
- [Everyday recipes](#everyday-recipes)
- [What's in this repo](#whats-in-this-repo)
- [Contributing to the marketplace](#contributing-to-the-marketplace)
- [Troubleshooting](#troubleshooting)

---

## Quick start

```
/plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable
/plugin install team-skills@parasbhatiwal
/reload-plugins
```

Then, in any project:

| Situation | Type this |
|---|---|
| Starting something new | `/new-project a billing service for…` |
| Inherited a codebase | `/audit` |
| Building a feature | `/feature add saved payment methods` |
| Fixing a bug | `/bug checkout 500s when the cart is empty` |
| No CLAUDE.md yet | `/context` |
| Nothing stops bad code | `/rules` |
| Shipping a version | `/release` |

---

## Installation

This repo is **private** — you need GitHub read access (collaborator or org
member) plus working git credentials (SSH key or `gh auth login`) before
either command resolves.

```
/plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable
/plugin install team-skills@parasbhatiwal
```

`@stable` pins to the `stable` branch, which only ever fast-forwards from a
reviewed `main`. Drop it only if you deliberately want to track `main`.

Pick a scope in the picker that follows:

- **User** — you, across all your projects (`~/.claude/settings.json`).
- **Project** — everyone on the repo you have open (that repo's
  `.claude/settings.json`; commit it so teammates get it after a one-time
  trust prompt).
- **Local** — you, this repo only, not shared.

Scripted/CI equivalent:

```sh
claude plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable
claude plugin install team-skills@parasbhatiwal --scope user|project
```

Verify with `/plugin` → **Installed**, or `/plugin list`. Manual-JSON
fallback and per-developer onboarding: [`examples/ONBOARDING.md`](examples/ONBOARDING.md).

---

## The 60-second version

1. **Standards are one place.** `engineering-principles` is the canon —
   no-patchwork doctrine, SOLID, DRY, boundaries, OWASP, operability, API and
   data design, testing, performance/a11y/i18n. Every other skill defers to it.
2. **Rules are enforced per project.** `project-rules` turns the canon into
   this repo's formatter, linter, strict types, boundary rules, coverage gates,
   security scanning, hooks, and CI. A rule that isn't a gate is a wish.
3. **Work flows through orchestrators.** `/feature` and `/bug` walk the whole
   path — design → TDD → review → gated commit → push → PR — stopping at every
   gate and asking before anything leaves your machine.
4. **Claude keeps its own context.** `/context` writes `CLAUDE.md`, and a
   session hook notices when it has drifted.
5. **Everything is language-agnostic.** Checks resolve through a standard task
   interface, so the same gates work in Go, Python, Rust, JVM, .NET, Ruby, PHP
   or JS.

---

## Commands

| Command | Runs | Use when |
|---|---|---|
| `/feature <ticket>` | `feature-ticket` | Building a feature end to end |
| `/bug <report>` | `bug-ticket` | Fixing a bug end to end |
| `/new-project <what>` | `bootstrap-project` | Greenfield repo |
| `/audit [area]` | `principles-audit` | Assessing an existing codebase |
| `/rules [area]` | `project-rules` | Making standards enforceable here |
| `/context [area]` | `project-context` | Creating or refreshing `CLAUDE.md` |
| `/adr <decision>` | `adr` | Recording a hard-to-reverse decision |
| `/release [version]` | `release` | Cutting a version |

Every other skill triggers itself from how you describe the task — you can
also name one directly ("run the threat-model skill on this").

---

## Skills

### Standards

**`engineering-principles`** — the single source of truth. `SKILL.md` holds
the non-negotiables and the **no-patchwork doctrine**: fix causes not symptoms;
if a change doesn't fit the design, change the design; no caller-specific
special cases; no swallowed errors; no weakened tests or types to get to green.
Depth sits in references loaded only when relevant:

| Reference | Covers |
|---|---|
| `design.md` | Dependency rule, SOLID applied, DRY vs. wrong abstraction, coupling/cohesion, typed errors, ADRs, review-stopping smells |
| `security.md` | OWASP Top 10 as concrete code rules, secrets, input handling, supply chain, what must trigger a security review |
| `operability.md` | 12-factor config, structured logging + correlation ids, RED/USE metrics, timeouts/retries/circuit breakers, safe migrations, rollout, runbooks |
| `api-and-data.md` | Contract-first, versioning, pagination, DB constraints, transactions, caching, PII classification and erasure |
| `testing.md` | Test shape, fakes over mocks, what never to mock, coverage as a floor, characterization tests for legacy code |
| `quality-attributes.md` | Performance budgets, WCAG 2.2 AA, i18n, maintainability |

**`project-rules`** (`/rules`) — makes the canon true for one project: task
interface, formatter, linter (warnings are failures), strict types, boundary
lint, coverage gates, security scanning, git/review policy, Claude settings.
Records the rule set and every deliberate exception — **scoped, justified and
dated** — in `docs/engineering-rules.md`. Introduces rules *ratcheted*, never
big-bang, and doesn't call a rule enforced until it has been seen to fail.

### Project lifecycle

**`bootstrap-project`** (`/new-project`) — greenfield. Asks about scale,
constraints and compliance *before* choosing anything; proposes architectures
sized to the answers (defaulting to a modular monolith with real boundaries);
records ADRs; lays down a skeleton with boundaries enforced by lint; gets
**guardrails green in CI before any feature code**; builds the cross-cutting
foundations (config, error taxonomy, logging, health, migrations, authz,
HTTP client with timeouts); then ships one walking vertical slice.

**`principles-audit`** (`/audit`) — existing codebases. Read-only. Inventory
including a **git churn map**, cited `file:line` evidence per area, a 0–4
maturity score, P0–P3 ranking by impact × likelihood × churn, and a phased
plan in `docs/engineering-remediation-plan.md`: make change safe → stop the
bleeding → strangler-fig boundaries → pay down by churn → automate the floor.
Never proposes a rewrite as the default.

**`project-context`** (`/context`) — scans the repo and writes a high-signal
`CLAUDE.md`: verified command table, architecture, domain vocabulary, gotchas,
env var *names*. Content between `<!-- claude-context:begin/end -->` is
Claude-managed; everything outside is yours and is never rewritten. It stamps
a fingerprint, and a `SessionStart` hook nudges when the context has drifted —
commits piled up, structural files changed, or it's simply old. Silent when
fresh.

### The delivery workflow

Two orchestrators sequence the atomic skills; each stage is its own skill and
each gate is hard.

```
/feature → brainstorm → [threat-model] → [adr] → implement (per chunk, TDD)
           → review-changes → commit-changes* → push-branch* → open-pr*

/bug     → diagnose (failing repro test) → implement (fix) → review-changes
           → commit-changes* → push-branch* → open-pr*
                                                    * = always asks you first
```

| Skill | What it guarantees |
|---|---|
| `brainstorm` | 2–4 real options with tradeoffs, a recommendation, and chunks small enough for one red→green→refactor |
| `threat-model` | STRIDE pass over the design; every mitigation becomes a testable requirement, including the denied cases |
| `adr` | Hard-to-reverse decisions recorded when made, with alternatives taken seriously |
| `implement` | Strict TDD; never weakens a test or type to get green |
| `diagnose` | A bug is reproduced by a failing test before any fix exists |
| `run-tests` | Detects the toolchain in any language; "no tests found" is RED, never green |
| `review-changes` | One round of `/code-review`, security routing to `/security-review`, plus the principles pass (patch vs. fix) |
| `commit-changes` | Full gate matrix, conventional message, both `Co-Authored-By` trailers — **asks first** |
| `push-branch` | Never pushes to `main`, re-verifies green — **asks first** |
| `open-pr` | Team PR body plus the human-verification section you fill in — **asks first** |

### Maintenance

**`release`** (`/release`) — derives the semantic version from conventional
commits since the last tag, writes a user-facing changelog, updates version
files, tags and hands off to publish. Asks before tagging and **again** before
publishing; refuses to release on a red or unverified gate.

**`dependency-upgrade`** — batches updates by risk (security → patch → minor →
one commit per major), verifies each against the full suite, reads changelogs,
vets new dependencies, and triages Dependabot/Renovate PRs instead of merging
them blind.

---

## Enforcement: what actually blocks you

Three independent layers. Skills advise; these decide.

**1. In-session hooks** (this plugin, active wherever it's installed)

- `guard-git.mjs` blocks: `git commit`/`push --no-verify`, commits missing
  either `Co-Authored-By` trailer, force-push and history rewrites on
  `main`/`master`, and self-merging a PR unless you're on the allowlist
  (`TEAM_SELF_MERGE_ALLOWLIST`, default: the owner account).
- `session-context.mjs` nudges when `CLAUDE.md` has drifted.

**2. Committed git hooks** (per project, from `examples/githooks/`)

- `commit-msg` — both trailers, plus the **TDD test-presence gate**: staged
  logic source with no test change is rejected. Break-glass is a
  `Justified-Exception: <reason>` trailer in the message — that trailer *is*
  the mechanism, there's no flag or env var.
- `pre-commit` — `format-check`, `lint`, `typecheck`, secret scan. A task the
  project doesn't define is reported and skipped; a defined task that fails
  blocks.
- `pre-push` — full suite green. No runnable test task = blocked.

**3. CI** (per project, from `examples/github-workflows/`)

- `ci.yml` — sets up whichever toolchains the repo actually contains, runs the
  same tasks the hooks run, then diff coverage ≥ 90% on changed lines, a total
  coverage ratchet (base measured in a worktree and cached by base SHA),
  dependency vulnerabilities, and secret scanning over history.
- `commit-policy.yml` — trailers on every commit, break-glass commits audited
  and required to carry a `break-glass` PR label.

**Ask-first, always:** commit, push, PR, tag, publish. Even inside an
orchestrator, even for a one-line change.

---

## Language support

Nothing assumes npm. Every check resolves through a **standard task
interface** — `install`, `format-check`, `lint`, `typecheck`, `test`,
`test-coverage`, `build`, `security` — in this order:

1. `make <task>` if a `Makefile` defines it
2. `just <task>` if a `justfile` defines it
3. Ecosystem detection from the manifest
4. Unresolved — reported explicitly; for `test` that blocks

First-class detection: **JavaScript/TypeScript, Python, Go, Rust, Java/Kotlin,
C#/.NET, Ruby, PHP, Elixir, Swift, Dart/Flutter**, with notes for C/C++,
shell and Terraform. Full matrix — commands, coverage formats, boundary-lint
and security tools per language — in
[`plugins/team-skills/references/toolchains.md`](plugins/team-skills/references/toolchains.md).

Polyglot repos and monorepos: copy [`examples/Makefile.template`](examples/Makefile.template)
and define the tasks once; hooks, CI and skills all get one entry point.
Test-file conventions per language (`*_test.go`, `test_*.py`, `*Test.java`,
`*_spec.rb`, …) are recognized by the TDD gate.

---

## Setting up a project

New repo: run `/new-project` and it does all of this in order. Existing repo:

```sh
# 1. Copy the templates from this marketplace
cp -r examples/githooks            .githooks/
cp    examples/github-workflows/*  .github/workflows/
cp    examples/pull_request_template.md .github/
cp    examples/gitleaks.toml       .
cp    examples/project-settings.json .claude/settings.json
cp    examples/Makefile.template   Makefile        # polyglot/monorepo, optional

# 2. Point git at the hooks (once per clone)
sh examples/setup-git-hooks.sh

# 3. Let Claude do the rest
/rules      # make the standards enforceable for this stack
/context    # write CLAUDE.md
/audit      # if the codebase is inherited: get the remediation plan
```

Then, on GitHub: require `ci` + `commit-policy` in branch protection, add
`CODEOWNERS`, and enable Dependabot/Renovate.

---

## Everyday recipes

**"Build this feature."** → `/feature <description>`. Confirm the approach when
asked, then approve commit / push / PR at the three gates.

**"Production is broken."** → `/bug <symptom>`. You'll get a failing repro test
and a root cause before any fix is written.

**"Is this codebase any good?"** → `/audit`. Read the score table and the three
Monday items at the end of the plan.

**"Nothing stops people committing untested code."** → `/rules`, then copy the
hooks and CI templates above.

**"Claude keeps forgetting how this project works."** → `/context`, then commit
the `CLAUDE.md` it writes.

**"Is this design safe?"** → "run the threat-model skill on <feature>" before
implementing.

**"Time to ship."** → `/release`.

**"Twelve Dependabot PRs."** → "use the dependency-upgrade skill to triage
these."

---

## What's in this repo

```
.claude-plugin/marketplace.json      # marketplace index
plugins/team-skills/
  .claude-plugin/plugin.json
  skills/                            # 19 skills (see above)
  commands/                          # /feature /bug /new-project /audit
                                     # /rules /context /adr /release
  hooks/
    guard-git.mjs   + policy.mjs           # git guardrails (rules are pure/tested)
    session-context.mjs + context-freshness.mjs   # CLAUDE.md drift check
  references/
    toolchains.md                    # task interface + per-language detection
    testing-bootstrap.md             # test setup for every ecosystem
    conventional-commits.md          # commit format
    pr-description.md                # PR body structure
scripts/
  validate-skills.mjs                # manifest/skill/reference validation
  check-version-bump.mjs             # skills or hooks changed ⇒ version moves
tests/                               # node --test suite over hooks and scripts
examples/                            # per-project templates
  githooks/ (_lib.sh, commit-msg, pre-commit, pre-push)
  github-workflows/ (ci.yml, commit-policy.yml)
  Makefile.template, pull_request_template.md, project-settings.json,
  gitleaks.toml, CLAUDE.md.template, setup-git-hooks.sh, ONBOARDING.md
CODEOWNERS
```

---

## Contributing to the marketplace

1. Branch, then edit `plugins/team-skills/skills/<name>/SKILL.md` (or a hook,
   or a reference).
2. **Bump `version`** in `plugins/team-skills/.claude-plugin/plugin.json` — CI
   fails a PR that changes `skills/` or `hooks/` without one, so teammates
   never receive new behavior under an unchanged version.
3. Hook and script changes need tests in `tests/` — this repo is held to the
   same TDD rule it enforces elsewhere.
4. Run locally:
   ```sh
   npm run lint && npm run validate && npm test
   ```
   The validator checks manifests, frontmatter, that every referenced skill
   exists, that every `../references/...` path resolves, and that plugin names
   agree.
5. Open a PR — `validate.yml` must be green, CODEOWNERS review required.
6. Merge to `main`, then fast-forward `stable`:
   ```sh
   git checkout stable && git merge --ff-only main && git push
   ```

Projects pin to `stable`, so a bad merge to `main` never reaches the team
instantly.

### Repo protection (maintainers, one-time)

- Protect `main`: require PR, the `validate` check, CODEOWNERS review.
- Keep `stable` fast-forward-only from `main`.

> **Known limitation (as of Jul 2026):** branch protection and CODEOWNERS
> enforcement are not available on private repos under the GitHub Free plan
> (API returns 403). Options: (a) upgrade to Pro/Team, (b) make this repo
> public — skills and hooks contain no secrets, or (c) accept convention-only
> protection here. The `validate` CI still runs on every PR either way; what's
> missing is the server-side block on direct pushes to `main`.

---

## Troubleshooting

**The plugin doesn't appear.** `/plugin marketplace list` (is `parasbhatiwal`
registered?) then `/plugin list` (is `team-skills@parasbhatiwal` enabled?).
Re-add with `/plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable`,
then `/reload-plugins`.

**Marketplace add/install fails.** You probably lack repo access. Check
`gh auth status` and `git ls-remote git@github.com:parasbhatiwal/paras-claude-marketplace`.

**A commit is blocked and I don't know why.** The message names the gate.
Missing trailers → use `commit-changes`. Test-presence → add a test, or add a
`Justified-Exception: <reason>` trailer if it genuinely qualifies (hotfix,
generated code, docs, dep bump). Never `--no-verify` — the guard blocks it and
CI re-checks anyway.

**A check says "not configured for this project".** That task isn't defined
for your stack. Add it to a `Makefile`/`justfile` or install the ecosystem's
tool — see `references/toolchains.md`, or just run `/rules`.

**Push blocked: "no test task found".** The project has no runnable test
suite. That's the finding, not an obstacle — see
`references/testing-bootstrap.md` or run `/rules`.

**CI can't find a coverage report.** Your coverage tool isn't emitting
Cobertura XML, or it's in an unusual path — configure the reporter, or set
`COVERAGE_XML` in `ci.yml`.

**A gate is wrong** (e.g. a generated file counted as source). Fix the globs in
`.githooks/_lib.sh` via a PR — don't bypass.

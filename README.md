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
  - [A brand-new project](#a-brand-new-project)
  - [An existing project](#an-existing-project)
- [Everyday recipes](#everyday-recipes)
- [What's in this repo](#whats-in-this-repo)
- [How updates reach you](#how-updates-reach-you)
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
| `/go [anything]` | `route` | **Start here if unsure** — reads the repo and request, picks the flow, runs it |
| `/triage [#n or "what needs attention"]` | `triage` | Raw incoming issues and PRs |
| `/work <issue or requirement>` | `work` | **Anything you hand to an agent** — intake, grilling, readiness gate, delivery |
| `/deliver <epic>` | `deliver` | Run autonomous delivery of `ready-for-agent` tickets |
| `/feature <ticket>`, `/bug <report>` | `work` | Aliases for `/work` (attended single-session path: ask for `feature-ticket` / `bug-ticket` by name) |
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

All 21 skills at a glance. Most trigger themselves from how you describe the
task; the ones with a command are the deliberate entry points.

| Skill | Command | Use it when | You get |
|---|---|---|---|
| **Standards** | | | |
| `engineering-principles` | — | Always — consulted by design, implement, review | The rules everything else defers to |
| `project-rules` | `/rules` | Standards aren't enforced by anything | Configured gates + `docs/engineering-rules.md` |
| **Lifecycle** | | | |
| `bootstrap-project` | `/new-project` | Starting from nothing | Architecture, ADRs, guardrails, walking slice |
| `principles-audit` | `/audit` | You inherited a codebase | Scored report + `docs/engineering-remediation-plan.md` |
| `ux-audit` | — | The product's UI/UX needs a redesign or modernization pass | Cited audit + `docs/ui-ux-implementation-plan.md` |
| `project-context` | `/context` | Claude keeps re-learning the repo | `CLAUDE.md` that maintains itself |
| **Delivery** | | | |
| `feature-ticket` | `/feature` | Building a feature end to end | Branch → PR, every gate enforced |
| `bug-ticket` | `/bug` | Fixing a bug end to end | Repro test → fix → PR |
| `brainstorm` | — | Deciding an approach | 2–4 options, a recommendation, TDD-able chunks |
| `threat-model` | — | Auth, payments, PII, uploads, tenancy | Ranked threats, each with a test |
| `adr` | `/adr` | A decision that's expensive to reverse | `docs/adr/NNNN-*.md` |
| `implement` | — | Writing production code | Red → green → refactor, no shortcuts |
| `diagnose` | — | Understanding a bug | A failing repro test + root cause |
| `run-tests` | — | "Do the tests pass?" | A verdict you can trust in any language |
| `review-changes` | — | Before committing | Findings fixed, suite green |
| `commit-changes` | — | Committing | Gated, compliant commit — **asks first** |
| `push-branch` | — | Pushing | Never to `main`, suite re-verified — **asks first** |
| `open-pr` | — | Raising a PR | Team PR body — **asks first** |
| **Maintenance** | | | |
| `release` | `/release` | Cutting a version | Version, changelog, tag |
| `dependency-upgrade` | — | Updates or Dependabot PRs | Risk-batched, verified upgrades |
| `ship-change` | — | Changing **this** marketplace repo | The full release flow, incl. the silent steps |

---

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

**`ux-audit`** — existing products with a real UI surface. Read-only. First
gates on whether a UI surface actually exists — no fabricated screens or design
systems for a CLI, library, or API-only repo. Audits IA, hierarchy, components,
states, responsiveness and accessibility with cited evidence, prioritizes
P0–P3, and writes a screen-by-screen, file-level `docs/ui-ux-implementation-
plan.md` that `feature-ticket` can execute. Refuses generic templates
(sidebar+cards+charts) in favor of layouts derived from the actual user
workflow.

**`project-context`** (`/context`) — scans the repo and writes a high-signal
`CLAUDE.md`: verified command table, architecture, domain vocabulary, gotchas,
env var *names*. Content between `<!-- claude-context:begin/end -->` is
Claude-managed; everything outside is yours and is never rewritten. It stamps
a fingerprint, and a `SessionStart` hook nudges when the context has drifted —
commits piled up, structural files changed, or it's simply old. Silent when
fresh.

### The v2 workflow: grill once, deliver without you

```
/work <issue # or plain requirement>
  intake ─► grill ─► spec-and-tickets ─► handoff-gate ─► deliver ─► ONE PR → main
            (you answer everything here)                 (no human; usually cloud)
```

1. **`intake`** — an issue number is fetched; plain text becomes a normal
   GitHub issue first. Labelled `needs-triage` + `bug`/`enhancement`.
2. **`grill`** — the exhaustive interview, in rounds, each question carrying a
   recommended answer. Facts are looked up, never asked. Runs `diagnose` for
   bugs, `threat-model`/`adr` where warranted, sharpens `GLOSSARY.md`. **This
   is your last touchpoint, so it asks everything.** Business questions get
   their own `needs-business-input` issue; non-blocking ones (reversible
   default) become labelled assumptions and work continues.
3. **`spec-and-tickets`** — spec on the epic, vertical-slice sub-issues with
   native blocking edges. You approve the breakdown.
4. **`handoff-gate`** — the zero-questions test per ticket, then an agent
   brief and `ready-for-agent` / `ready-for-human` / `needs-info`.
5. **`deliver`** — one integration branch `feat/<n>-<slug>` from main; each
   subtask on `feat/<n>-<slug>--t<m>`, TDD'd, reviewed, PR'd into it and
   merged when green; then full review, `CLAUDE.md` refresh, and **one PR to
   main** that it never merges. A question the brief didn't answer is never
   guessed: that subtask is marked `needs-info` and the rest continues.

Cloud runs set `TEAM_AUTONOMOUS=1`; the git guard then lets the agent
auto-merge into the feature branch but blocks any push or merge to main. See
`plugins/team-skills/references/autonomous-mode.md` — including turning on
branch protection on main, which is the real wall.

### Coverage: this plugin vs. AI Hero's skills

Every AI Hero (Matt Pocock) engineering and productivity skill with a general
use is adapted here (MIT, credited in `THIRD_PARTY_NOTICES.md`), then extended.

| AI Hero | Here | What v2 adds |
|---|---|---|
| `ask-matt` (advises) | `route`, `/go` | Reads repo + issue labels, resumes interrupted `deliver`, then **runs** the flow |
| `grilling`, `grill-me`, `grill-with-docs` | `grill` | Exhaustive checklist, business-question split with blocking vs assumption, folds in `threat-model`/`adr`/`prototype`/`research` |
| `domain-modeling` | `domain-modeling` | Glossary + ADR rules; `adr` skill for the record |
| `to-spec`, `to-tickets` | `spec-and-tickets` | Native blocking edges; security/ADR deliverables become tickets |
| `triage` | `triage` | + feeds `grill`/`handoff-gate`; same state machine and `.out-of-scope/` KB |
| `implement-spec` | `deliver` | **Autonomous mode enforced by a hook**, stuck rule, one-PR-to-main guarantee |
| `implement`, `tdd` | `implement` | Seams, vertical slices, no tautological tests — plus a hook-enforced test gate |
| `diagnosing-bugs` | `diagnose` | Feedback-loop-first, plus root-cause, siblings, blast radius |
| `code-review` | `review-changes` | Two-axis (Standards + Spec) in parallel, smell baseline, plus principles and security routing |
| `pr` | `open-pr` + `pr-description` | Same visual/evidence/door sections, plus mandatory human-verification |
| `wayfinder`, `prototype`, `research`, `retro` | same names | `retro` also reads `deliver` friction and grill gaps |
| `codebase-design`, `improve-codebase-architecture` | `codebase-design`, `improve-architecture` | — |
| `handoff`, `wait-what`, `to-questionnaire`, `wizard`, `writing-for-agents` | same names | `to-questionnaire`/`wizard` wired into business issues and human-only tickets |
| `setup-matt-pocock-skills` | `setup-workflow` | + branch-protection and cloud-readiness checks |
| `git-guardrails`, `setup-pre-commit` | `guard-git` hook, `examples/githooks` | Always on; tested |

Only here: `handoff-gate` (zero-questions test), `threat-model`,
`engineering-principles`, `project-context` freshness hook, `ux-audit`,
`release`, `dependency-upgrade`, quality guards.

**Not ported, deliberately:** course/personal tooling (`teach`,
`scaffold-exercises`, `migrate-to-shoehorn`, in-progress writing and
chief-of-staff skills). **Known gap:** AI Hero also supports local-markdown
and GitLab trackers; this plugin is GitHub-only.

### The attended delivery workflow (v1 path)

Two orchestrators sequence the atomic skills; each stage is its own skill and
each gate is hard.

```
/feature → brainstorm → [threat-model] → [adr] → implement (per chunk, TDD)
           → review-changes → commit-changes* → push-branch* → open-pr*

/bug     → diagnose (failing repro test) → implement (fix) → review-changes
           → commit-changes* → push-branch* → open-pr*
                                                    * = always asks you first
```

**`feature-ticket`** (`/feature`) — the default way to build anything. Branches,
designs the approach, breaks it into chunks each small enough for one
red→green→refactor, implements them in order with the suite green between
chunks, reviews the whole diff, then walks the three ask-gates. A failed gate
never falls through; a mid-flight scope change sends it back to design rather
than patching around it.
*Note: it will stop and ask if the approach materially affects you — API shape,
UX, cost. That question is the point, not friction.*

**`bug-ticket`** (`/bug`) — same spine, different opening move: **no fix code
exists until a failing test reproduces the bug.** If diagnosis shows the "bug"
is intended behavior or a requirements gap, it stops and says so instead of
inventing a fix. Sibling occurrences found during diagnosis each get their own
failing test.
*Note: it deliberately keeps the fix minimal. Refactors the bug exposes are
reported as follow-ups, not smuggled into the diff.*

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

Notes that trip people up:

- **`implement` will refuse to write code if the project has no test runner.**
  That is deliberate — bootstrap tests first (`/rules`, or the audit's Phase 0).
- **`run-tests` treats "0 tests found" as RED.** A passing command that ran
  nothing is exactly how a broken test config hides for months.
- **`review-changes` is one round by design.** The second round is a human on
  the PR; endless self-review rounds stall delivery.
- **The three ask-gates never auto-approve**, even inside `/feature` or `/bug`,
  even for a one-line change. Approving a commit is not approving the push.
- **`threat-model` is worth running on a small feature too** — fifteen minutes
  beats an incident, and its output feeds straight into the chunk list.

### Maintenance

**`release`** (`/release`) — derives the semantic version from conventional
commits since the last tag, writes a user-facing changelog, updates version
files, tags and hands off to publish. Asks before tagging and **again** before
publishing; refuses to release on a red or unverified gate.

**`dependency-upgrade`** — batches updates by risk (security → patch → minor →
one commit per major), verifies each against the full suite, reads changelogs,
vets new dependencies, and triages Dependabot/Renovate PRs instead of merging
them blind.
*Note: it flags EOL/unmaintained packages as migrations needing their own
ticket, not as upgrades to squeeze into this batch.*

### Maintaining this repo

**`ship-change`** — a repo-level skill in `.claude/skills/`, not shipped in the
plugin (no other project has a `stable` branch or a `plugin.json` to bump). Say
*"ship this change"* and it drives branch → change → tests → version bump →
verify → PR → merge → fast-forward `stable`, which is the flow in
[Contributing](#contributing-to-the-marketplace).
*Note: it exists because two of those steps fail silently — see
[How updates reach you](#how-updates-reach-you).*

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

The two starting points are different on purpose: a new project can have every
gate on from commit one, an existing one cannot without grinding to a halt.

### A brand-new project

One command does the whole thing — just answer its questions honestly:

```
/new-project a billing service for internal teams, ~200 req/s, handles card data
```

It will, in order: ask about scale/constraints/compliance **before** choosing a
stack; propose 2–3 architectures and confirm one with you; record ADRs; lay
down the skeleton with boundaries enforced by lint; get every guardrail green
in CI (**no feature code until then**); build the cross-cutting foundations;
write `CLAUDE.md`; and ship one thin vertical slice end to end.

Expect to be asked questions early and to approve the architecture. That is the
cheapest moment to get it right.

### An existing project

**Do not turn everything on at once.** A rule that fails 400 files on Monday
gets disabled on Tuesday. Work through this in order, over days or weeks:

```
Step 1  /context     Write CLAUDE.md first — everything else works better with it
Step 2  /audit       Read-only. Get the scored report + phased plan. Change nothing yet
Step 3  Phase 0      From that plan: test runner + CI + hooks + characterization
                     tests on the highest-churn code. Nothing else is safe first
Step 4  /rules       Turn on gates ONE at a time, ratcheted: enable globally,
                     allowlist today's violations, forbid adding to it, shrink
Step 5  /feature     Start working normally. New code meets the bar; old code
        /bug         improves where you touch it (Phase 3 of the plan)
```

The manual copying, once you're ready for gates (step 3–4):

```sh
cp -r examples/githooks            .githooks/     # whole dir — hooks source _lib.sh
cp    examples/github-workflows/*  .github/workflows/
cp    examples/pull_request_template.md .github/
cp    examples/gitleaks.toml       .gitleaks.toml   # the dot matters — see below
cp    examples/project-settings.json .claude/settings.json
cp    examples/Makefile.template   Makefile        # polyglot/monorepo, optional
sh    examples/setup-git-hooks.sh                  # once per clone
```

Then on GitHub: require `ci` + `commit-policy` in branch protection, add
`CODEOWNERS`, enable Dependabot/Renovate.

**If the project has no tests at all**, step 3 is not optional and nothing else
in the plan can proceed without it — that is the single finding that blocks
everything else.

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
.claude/skills/ship-change/          # repo-level: how a change gets released
plugins/team-skills/
  .claude-plugin/plugin.json
  skills/                            # 20 skills (see above)
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
  validate-skills.mjs                # manifest/skill/reference validation,
                                     # incl. .claude/skills/
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

## How updates reach you

You installed the plugin pinned to `@stable`. Here is what has to happen for a
change the maintainer makes to land on your machine:

```
maintainer merges to main   →  nothing reaches you yet
maintainer fast-forwards    →  stable is the published ref — THIS is the release
  stable
plugin version changed?     →  yes → you get it     no → silently skipped
```

Two things are worth knowing:

**The version string is the trigger.** Claude Code skips a plugin update when
the resolved `version` matches what you already have. A change published under
an unchanged version reaches nobody, with no error. (CI enforces the bump, so
this shouldn't happen — but it's why it's enforced.)

**Auto-update depends on how the marketplace was cloned.** The background
refresh disables git credential helpers, so it can't authenticate to this
**private** repo over HTTPS; it falls back to a full re-clone that can time
out. SSH is unaffected. The `owner/repo` form in [Installation](#installation)
clones over SSH by default, so following those instructions with an SSH key in
`ssh-agent` gives you working auto-updates.

| How you added it | Background auto-update |
|---|---|
| `parasbhatiwal/paras-claude-marketplace@stable` (SSH, the default) | ✅ works |
| An `https://` URL, or `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` | ⚠️ unreliable |

Force an update at any time:

```
/plugin marketplace update parasbhatiwal
/plugin update team-skills@parasbhatiwal
/reload-plugins                              # apply it mid-session
```

Set `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` to keep your working
copy when a background pull fails, instead of deleting and re-cloning.

---

## Contributing to the marketplace

Ask Claude to **"ship this change"** and the repo-level `ship-change` skill
(in `.claude/skills/`) drives the whole flow below. It exists because two of
these steps fail *silently* — nothing errors, the change just never arrives.

### The flow

```
1. branch        git checkout -b feat/<slug>          never edit main directly
2. change        skill / hook / reference / template
3. test          tests/ — required for any .mjs change
4. BUMP VERSION  plugins/team-skills/.claude-plugin/plugin.json    ← silent if skipped
5. verify        npm run lint && npm run validate && npm test
6. PR            gh pr create  →  validate must be green
7. merge         gh pr merge --merge                  main updated, users unaffected
8. PUBLISH       git checkout stable
                 git merge --ff-only main && git push origin stable   ← silent if skipped
9. confirm       git rev-parse --short origin/main origin/stable      both must match
```

Skip steps 4 and 8 only when nothing under `plugins/` changed (a repo-level
skill, a script, this README). CI's `check-version-bump` fails the PR whenever
the bump was actually required.

**`.claude/skills/ship-change/SKILL.md` is canonical** for the details this
summary deliberately omits — how to size the version bump, what to do about a
bad release, and the gotchas (`git mv` staging renames early; CI being the only
place Node 20 runs). Ask Claude to *"ship this"* and it follows that file; it is
not repeated here so the two cannot drift apart.

### What CI checks

`validate.yml` runs on every PR: syntax-checks the scripts, shellchecks the
shell templates, runs the validator (manifests, frontmatter, every referenced
skill exists, every explicitly-relative reference resolves, plugin names
agree, `.claude/skills/` held to the same bar), runs the full test suite, and
fails the PR if `skills/` or `hooks/` changed without a version bump.

CI is the **only** place Node 20 is exercised — local Node is newer, so
version-specific breakage surfaces there and nowhere else.

Released versions and what changed in each: [`CHANGELOG.md`](CHANGELOG.md).

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

**I changed a skill but my teammate still has the old one.** Almost always one
of the two silent steps in [the flow](#the-flow): the plugin `version` wasn't
bumped, or `stable` wasn't fast-forwarded. Check both:

```sh
git rev-parse --short origin/main origin/stable        # must match
git show origin/stable:plugins/team-skills/.claude-plugin/plugin.json | grep version
```

If both are right, it's delivery: have them run `/plugin marketplace update
parasbhatiwal` and `/plugin update team-skills@parasbhatiwal`. If that fixes
it every time, their marketplace is cloned over HTTPS — see
[How updates reach you](#how-updates-reach-you).

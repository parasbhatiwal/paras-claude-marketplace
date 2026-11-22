# Skills guide

The deep dive behind the [skill catalog in the README](../README.md#skill-catalog):
what each group of skills guarantees, how the workflows chain together, and how
this plugin relates to the [AI Hero](https://github.com/mattpocock/skills)
skills it adapts.

> **Invoking skills by tool.** The skills are shared. Claude Code has slash
> commands (`/work`, `/go`, ...); Codex invokes a skill with a `$` mention
> (`$work`, `$route`); Cursor types `/` and the skill name (`/work`, `/route`).
> The README's [Works with](../README.md#works-with) section has the full table
> and the limits of each tool.

## Standards

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

## Project lifecycle

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

## The v2 workflow: grill once, deliver without you

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

## Coverage: this plugin vs. AI Hero's skills

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
## The attended delivery workflow (v1 path)

For work you will watch from start to finish in one session. Ask for
`feature-ticket` or `bug-ticket` by name (the `/feature` and `/bug` commands now
run `work` instead). Two orchestrators sequence the atomic skills; each stage is
its own skill and each gate is hard.

```
feature-ticket → brainstorm → [threat-model] → [adr] → implement (per chunk, TDD)
           → review-changes → commit-changes* → push-branch* → open-pr*

bug-ticket     → diagnose (failing repro test) → implement (fix) → review-changes
           → commit-changes* → push-branch* → open-pr*
                                                    * = always asks you first
```

**`feature-ticket`** — the attended way to build a feature. Branches,
designs the approach, breaks it into chunks each small enough for one
red→green→refactor, implements them in order with the suite green between
chunks, reviews the whole diff, then walks the three ask-gates. A failed gate
never falls through; a mid-flight scope change sends it back to design rather
than patching around it.
*Note: it will stop and ask if the approach materially affects you — API shape,
UX, cost. That question is the point, not friction.*

**`bug-ticket`** — same spine, different opening move: **no fix code
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
- **The three ask-gates never auto-approve**, even inside `feature-ticket` or `bug-ticket`,
  even for a one-line change. Approving a commit is not approving the push.
- **`threat-model` is worth running on a small feature too** — fifteen minutes
  beats an incident, and its output feeds straight into the chunk list.

## Maintenance

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

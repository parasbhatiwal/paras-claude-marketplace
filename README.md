# Paras Claude Marketplace

**A Claude Code plugin that gives Claude an engineering team's discipline:
settle the requirements first, build with tests first, and let hooks and CI —
not documents nobody re-reads — enforce the rules.**

It ships as one plugin, `team-skills`: 42 skills, 13 slash commands, and a set
of git-guard hooks. It works in any language and on any project.

> **New to Claude Code plugins?** A *plugin* bundles skills (instructions
> Claude follows for a kind of task), slash commands, and hooks (scripts that
> run on events such as "before a git commit"). A *marketplace* is a git repo
> that lists plugins so you can install them. This repo is both.

---

## Contents

- [Why this exists](#why-this-exists)
- [Install](#install)
- [Your first five minutes](#your-first-five-minutes)
- [How the workflow works](#how-the-workflow-works)
- [Commands](#commands)
- [Skill catalog](#skill-catalog)
- [What actually blocks you](#what-actually-blocks-you)
- [Language support](#language-support)
- [Adopting it in a project](#adopting-it-in-a-project)
- [Staying up to date](#how-updates-reach-you)
- [Troubleshooting](#troubleshooting)
- [Repo layout](#repo-layout)
- [Contributing and credits](#contributing-and-credits)

---

## Why this exists

Left alone, an AI coding agent tends to start coding before it understands the
task, patch symptoms instead of causes, skip tests, and push things you didn't
mean to ship. This plugin addresses that with three ideas:

1. **Ask everything up front, then work alone.** `/work` interviews you until
   every decision is settled (the "grill"), then builds the result on a feature
   branch and opens a single pull request. You review one PR, not a hundred
   half-questions.
2. **Standards live in one place.** A single `engineering-principles` skill
   (SOLID, boundaries, OWASP security, testing, operability, a "fix causes, not
   symptoms" rule) is what every other skill defers to.
3. **Rules that aren't enforced are wishes.** Hooks block bad commits and
   pushes, git hooks and CI re-check them, and every commit, push, and PR asks
   you first.

You don't need to adopt all of it. Each skill also works on its own, by name.

---

## Install

You need Claude Code and `git`. For the full workflow you also need the
[GitHub CLI](https://cli.github.com) signed in (`gh auth login`), because
issues, labels, and PRs are driven through it. No access grant is needed; the
repo is public.

Inside any Claude Code session:

```
/plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable
/plugin install team-skills@parasbhatiwal
/reload-plugins
```

`@stable` pins you to the `stable` branch, which only moves forward from a
reviewed `main`. Drop it only if you want to track `main` directly.

The installer asks for a scope: **User** (you, all projects), **Project**
(everyone on the repo you have open — commit `.claude/settings.json` so
teammates get it), or **Local** (you, this repo, not shared).

Check it worked with `/plugin` → **Installed**. Scripted install and
per-developer onboarding: [`examples/ONBOARDING.md`](examples/ONBOARDING.md).

---

## Your first five minutes

Open Claude Code in a project and pick the row that matches your situation:

| Situation | Type this |
|---|---|
| Not sure where to start | `/go` (describe anything; it picks the flow) |
| Building a feature | `/work add saved payment methods` |
| Fixing a bug | `/work checkout returns 500 when the cart is empty` |
| Starting a brand-new project | `/new-project a billing service for internal teams` |
| Inherited a codebase | `/audit` |
| Claude keeps forgetting how the project works | `/context` |
| Nothing stops untested code being committed | `/rules` |
| Issues are piling up | `/triage` |
| Ready to ship a version | `/release` |

A good first run is `/context`: it scans your repo and writes a `CLAUDE.md`
that every later session benefits from.

---

## How the workflow works

The core flow is `/work`. You take part in the first half; the second half runs
without you, usually in a cloud session.

```
/work <issue number or plain requirement>

  intake ─► grill ─► spec-and-tickets ─► handoff-gate ─► deliver ─► ONE PR → main
            └── you answer everything ──┘               └─ no human needed ─┘
```

| Stage | What happens |
|---|---|
| `intake` | Turns your input into exactly one GitHub issue (or fetches the one you named). |
| `grill` | Interviews you in rounds, each question with a recommended answer. Facts it can look up, it looks up rather than asks. This is your last touchpoint, so it asks everything. |
| `spec-and-tickets` | Writes a spec and splits the work into small vertical-slice tickets. You approve the breakdown. |
| `handoff-gate` | Checks that each ticket could be finished with zero questions, and marks it `ready-for-agent`, `ready-for-human`, or `needs-info`. |
| `deliver` | Builds on one feature branch, one PR per subtask (test-first, reviewed), then opens one final PR to `main`. It never merges that PR; you do. |

If a ticket's brief leaves a question open, `deliver` never guesses: it marks
that ticket `needs-info` and carries on with the rest.

Prefer to watch every step in one session? Ask for the `feature-ticket` or
`bug-ticket` skill by name. Commit, push, and PR creation still ask first.

More detail on every stage, and how this relates to the AI Hero skills it
adapts: [`docs/skills-guide.md`](docs/skills-guide.md).

---

## Commands

| Command | Runs skill | Use when |
|---|---|---|
| `/go [anything]` | `route` | Start here if unsure — reads the repo and request, picks the flow |
| `/work <issue or requirement>` | `work` | Anything you hand to an agent |
| `/deliver <epic>` | `deliver` | Run autonomous delivery of `ready-for-agent` tickets |
| `/triage [#n]` | `triage` | Raw incoming issues and PRs |
| `/verify <issue/PR/branch>` | `browser-verify` | Manually test a change in Chrome (needs Claude in Chrome) |
| `/feature <ticket>`, `/bug <report>` | `work` | Aliases for `/work` |
| `/new-project <what>` | `bootstrap-project` | Greenfield repo |
| `/audit [area]` | `principles-audit` | Assess an existing codebase |
| `/rules [area]` | `project-rules` | Make standards enforceable in this repo |
| `/context [area]` | `project-context` | Create or refresh `CLAUDE.md` |
| `/adr <decision>` | `adr` | Record a hard-to-reverse decision |
| `/release [version]` | `release` | Cut a version |

Every other skill triggers from how you describe the task, and you can name one
directly ("run the threat-model skill on this").

---

## Skill catalog

All 42 plugin skills, grouped. Skills with a command are the deliberate entry
points. Deep dives for each group are in [`docs/skills-guide.md`](docs/skills-guide.md).

| Skill | Command | Use it when | You get |
|---|---|---|---|
| **Entry & workflow** | | | |
| `route` | `/go` | Unsure which flow fits | Reads repo + request, picks and runs the right skill |
| `work` | `/work`, `/feature`, `/bug` | Handing over any task | Intake → grill → tickets → handoff gate |
| `intake` | — | Turning input into one GitHub issue | A labelled issue ready for grilling |
| `grill` | — | Settling every decision | Decision log, glossary, business questions split out |
| `spec-and-tickets` | — | After grilling | Spec + vertical-slice sub-issues with blocking edges |
| `handoff-gate` | — | Before autonomous delivery | Zero-questions test per ticket, agent briefs, labels |
| `deliver` | `/deliver` | Tickets are `ready-for-agent` | Integration branch, subtask PRs, one final PR |
| `triage` | `/triage` | Raw incoming issues and PRs | Labels, verified claims, briefs |
| `setup-workflow` | — | First run in a repo | Labels, branch-protection check, readiness checklist |
| **Planning & research** | | | |
| `wayfinder` | — | Effort too big or foggy for one session | Map of decision tickets |
| `prototype` | — | A design question needs a runnable answer | Throwaway logic demo or UI variants |
| `research` | — | A fact outside the repo is needed | Cited Markdown from primary sources |
| `to-questionnaire` | — | The answer is in someone else's head | A questionnaire aimed at the gap |
| `wizard` | — | Only a human can take the step | Interactive bash walkthrough |
| `domain-modeling` | — | Fuzzy terms; ADR-worthy decisions | A sharp `GLOSSARY.md` |
| **Standards** | | | |
| `engineering-principles` | — | Always — consulted by design, implement, review | The rules everything else defers to |
| `project-rules` | `/rules` | Standards aren't enforced by anything | Configured gates + `docs/engineering-rules.md` |
| `codebase-design` | — | Shaping a module or placing a seam | Deep-module vocabulary |
| `writing-for-agents` | — | Writing a skill or `CLAUDE.md` | Pointer, hierarchy, and pruning rules |
| **Project lifecycle** | | | |
| `bootstrap-project` | `/new-project` | Starting from nothing | Architecture, ADRs, guardrails, a walking slice |
| `principles-audit` | `/audit` | You inherited a codebase | Scored report + phased remediation plan |
| `ux-audit` | — | The UI/UX needs a modernization pass | Cited audit + implementation plan |
| `project-context` | `/context` | Claude keeps re-learning the repo | A self-maintaining `CLAUDE.md` |
| `improve-architecture` | — | Spare time; keep the code easy to change | HTML report of deepening opportunities |
| **Delivery building blocks** | | | |
| `feature-ticket` | — | You will watch a feature end to end | Branch → PR, every gate enforced |
| `bug-ticket` | — | You will watch a fix end to end | Repro test → fix → PR |
| `brainstorm` | — | Deciding an approach | 2–4 options, a recommendation, TDD-able chunks |
| `threat-model` | — | Auth, payments, PII, uploads, tenancy | Ranked threats, each with a test |
| `adr` | `/adr` | A decision that's expensive to reverse | `docs/adr/NNNN-*.md` |
| `implement` | — | Writing production code | Red → green → refactor |
| `diagnose` | — | Any bug, flake, or regression | Tight red loop, root cause, regression test |
| `browser-verify` | `/verify` | Test a change by hand in Chrome | Do/Expect plan, PASS/FAIL report |
| `run-tests` | — | "Do the tests pass?" | A trustworthy verdict in any language |
| `review-changes` | — | Before committing | Findings fixed, suite green |
| `commit-changes` | — | Committing | Gated, compliant commit — **asks first** |
| `push-branch` | — | Pushing | Never to `main` — **asks first** |
| `open-pr` | — | Raising a PR | Standard PR body — **asks first** |
| **Maintenance & session** | | | |
| `release` | `/release` | Cutting a version | Version, changelog, tag |
| `dependency-upgrade` | — | Updates or Dependabot PRs | Risk-batched, verified upgrades |
| `retro` | — | A build just ended, especially a rough one | Improvements to checks, standards, pointers |
| `handoff` | — | Work moves to a new session or person | Portable summary file |
| `wait-what` | — | You didn't follow Claude's last message | A plain-language re-pitch |

(The repo also has `ship-change`, a repo-level skill for releasing *this*
marketplace; it is not part of the plugin you install.)

---

## What actually blocks you

Skills advise; these decide. There are three independent layers.

**1. In-session hooks** — active wherever the plugin is installed.

- `guard-git` blocks `--no-verify`, commits missing the `Co-Authored-By`
  trailers, force-push and history rewrites on `main`/`master`, and
  self-merging a PR unless you're on the allowlist (`TEAM_SELF_MERGE_ALLOWLIST`).
- `session-context` notices when `CLAUDE.md` has drifted and reminds each
  session to route task requests through `route`/`work` before coding.
- **Autonomous mode** (`TEAM_AUTONOMOUS=1`, set by a cloud runtime, never by
  hand) lets the agent push and merge on feature and subtask branches but
  blocks any push or merge to `main`. See
  [`references/autonomous-mode.md`](plugins/team-skills/references/autonomous-mode.md),
  including turning on branch protection on `main`, which is the real wall.

**2. Git hooks** — per project, copied from [`examples/githooks/`](examples/githooks).
`commit-msg` requires the trailers and a test change alongside source changes
(break-glass: a `Justified-Exception: <reason>` trailer); `pre-commit` runs
format, lint, typecheck, and a secret scan; `pre-push` requires a green suite.

**3. CI** — per project, from [`examples/github-workflows/`](examples/github-workflows).
Runs the same tasks plus diff-coverage ≥ 90%, a coverage ratchet, dependency
vulnerability scanning, and secret scanning over history.

**Ask-first, always:** commit, push, PR, tag, publish. The single exception is
autonomous `deliver` in a cloud session, which can open PRs on feature branches
but can never touch `main`; a human merges the final PR.

---

## Language support

Nothing assumes npm. Every check resolves through a standard task interface —
`install`, `format-check`, `lint`, `typecheck`, `test`, `test-coverage`,
`build`, `security` — looked up in this order:

1. `make <task>` if a `Makefile` defines it
2. `just <task>` if a `justfile` defines it
3. Detection from the project manifest
4. Otherwise reported as unresolved (for `test`, that blocks)

Detected out of the box: **JavaScript/TypeScript, Python, Go, Rust,
Java/Kotlin, C#/.NET, Ruby, PHP, Elixir, Swift, Dart/Flutter**, with notes for
C/C++, shell, and Terraform. The full matrix is in
[`references/toolchains.md`](plugins/team-skills/references/toolchains.md). For
polyglot repos and monorepos, copy
[`examples/Makefile.template`](examples/Makefile.template) and define the
tasks once.

---

## Adopting it in a project

A new project can have every gate on from the first commit. An existing one
can't: a rule that fails 400 files on Monday gets disabled on Tuesday.

**New project** — one command, and answer its questions honestly:

```
/new-project a billing service for internal teams, ~200 req/s, handles card data
```

It asks about scale, constraints, and compliance *before* choosing a stack;
proposes architectures and confirms one with you; records ADRs; gets every
guardrail green in CI (no feature code until then); then ships one thin
vertical slice end to end.

**Existing project** — go in this order, over days or weeks:

```
Step 1  /context   Write CLAUDE.md first; everything else works better with it
Step 2  /audit     Read-only. Get the scored report and phased plan. Change nothing yet
Step 3  Phase 0    From the plan: test runner + CI + hooks + tests on the highest-churn code
Step 4  /rules     Turn gates on ONE at a time: enable, allowlist today's violations,
                   forbid adding to the list, shrink it
Step 5  /work      Work normally. New code meets the bar; old code improves as you touch it
```

When you're ready for gates (steps 3–4), copy the templates:

```sh
cp -r examples/githooks            .githooks/      # whole directory
cp    examples/github-workflows/*  .github/workflows/
cp    examples/pull_request_template.md .github/
cp    examples/gitleaks.toml       .gitleaks.toml  # note the leading dot
cp    examples/project-settings.json .claude/settings.json
cp    examples/Makefile.template   Makefile        # polyglot/monorepo, optional
sh    examples/setup-git-hooks.sh                  # once per clone
```

Then, on GitHub, require the `ci` and `commit-policy` checks in branch
protection, add a `CODEOWNERS`, and enable Dependabot or Renovate. If the
project has **no tests at all**, step 3 is not optional: that single gap blocks
everything else.

---

## How updates reach you

You installed pinned to `@stable`. For a change to land on your machine:

```
change merged to main   →  release-stable checks the plugin version
version moved?          →  yes: stable is fast-forwarded (this IS the release)
                           no:  nothing is published
you                     →  get it on your next marketplace refresh
```

**The version string is the trigger.** Claude Code skips a plugin update when
the version matches what you already have, so a change published under an
unchanged version reaches nobody and raises no error. CI enforces the bump for
exactly this reason.

Force an update at any time:

```
/plugin marketplace update parasbhatiwal
/plugin update team-skills@parasbhatiwal
/reload-plugins
```

Set `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` to keep your working
copy if a background pull fails. Release history: [`CHANGELOG.md`](CHANGELOG.md).

---

## Troubleshooting

**The plugin doesn't appear.** Run `/plugin marketplace list` (is
`parasbhatiwal` registered?) then `/plugin list` (is `team-skills@parasbhatiwal`
enabled?). Re-add it with the install command above, then `/reload-plugins`.

**Marketplace add or install fails.** The repo is public, so this is usually
network or `git`. Check `git ls-remote https://github.com/parasbhatiwal/paras-claude-marketplace`
works from the same terminal.

**A commit is blocked and I don't know why.** The message names the gate.
Missing trailers → use `commit-changes`. Test-presence → add a test, or add a
`Justified-Exception: <reason>` trailer if it genuinely qualifies (hotfix,
generated code, docs, dependency bump). Never `--no-verify`; the guard blocks
it and CI re-checks anyway.

**A check says "not configured for this project".** That task isn't defined for
your stack. Add it to a `Makefile`/`justfile`, install the ecosystem's tool
(see `references/toolchains.md`), or run `/rules`.

**Push blocked: "no test task found".** The project has no runnable test suite.
That's the finding, not an obstacle — see
[`references/testing-bootstrap.md`](plugins/team-skills/references/testing-bootstrap.md)
or run `/rules`.

**CI can't find a coverage report.** Your coverage tool isn't emitting
Cobertura XML, or writes it somewhere unusual. Configure the reporter, or set
`COVERAGE_XML` in `ci.yml`.

**A gate is wrong** (for example a generated file counted as source). Fix the
globs in `.githooks/_lib.sh` through a PR; don't bypass it.

**I'm on an old version.** Run the update commands in
[How updates reach you](#how-updates-reach-you). If you added the marketplace
over HTTPS while the repo was private and updates stall, remove and re-add it.
Maintainers: if a change isn't reaching people, see
[the release flow](CONTRIBUTING.md#the-flow) — the usual cause is a missed
version bump or `stable` fast-forward.

---

## Repo layout

```
.claude-plugin/marketplace.json      marketplace index
.claude/skills/ship-change/          repo-level skill: how a change gets released
.github/                             CI (validate), weekly upstream sync, stable release
plugins/team-skills/
  .claude-plugin/plugin.json         plugin manifest and version
  skills/                            the 42 skills (one SKILL.md each)
  commands/                          slash commands, thin entry points to skills
  hooks/                             git guard, quality guard, session context
  references/                        shared docs that skills point at
  THIRD_PARTY_NOTICES.md             credit for adapted AI Hero skills
scripts/                             validator, version-bump check, upstream sync tools
tests/                               node --test suite over hooks and scripts
examples/                            templates to copy into your own projects
docs/skills-guide.md                 deep dive on the skills and workflows
upstream.json                        pinned AI Hero version and file hashes
```

---

## Contributing and credits

- **Contributing:** see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the flow, what
  CI checks, and how repo protection works. Small fixes are welcome as plain PRs.
- **Credits:** many skills are adapted from Matt Pocock's
  [AI Hero skills](https://github.com/mattpocock/skills) (MIT), extended with
  autonomous delivery, hook enforcement, and more. Attribution is in
  [`plugins/team-skills/THIRD_PARTY_NOTICES.md`](plugins/team-skills/THIRD_PARTY_NOTICES.md).
  The weekly `upstream-sync` workflow keeps the adaptations current.
- **Known limits:** GitHub is the only supported issue tracker.

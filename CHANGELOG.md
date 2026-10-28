# Changelog

Notable changes to the `team-skills` plugin. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are the
`version` field in `plugins/team-skills/.claude-plugin/plugin.json`.

**A version only reaches teammates once `stable` is fast-forwarded** — see
[How updates reach you](README.md#how-updates-reach-you).

## [2.3.0] — 2026-10-28

### Changed

- **Local runs now offer a manual browser test.** When delivery runs on the
  user's machine (attended; `TEAM_AUTONOMOUS` not set) and the change has a
  web UI, `deliver`, `feature-ticket` and `bug-ticket` ask one yes/no question
  after review: test it in Chrome (`browser-verify`) before it goes up? A FAIL
  goes back through implementation; the verdict lands in the PR's Human
  verification section. Cloud runs never ask and never run it, since nobody is
  there to answer and there is no browser; the PR notes it was not
  browser-tested. `browser-verify` itself stays available on demand.

## [2.2.0] — 2026-10-28

### Added

- **`browser-verify` skill + `/verify`**: manual testing in a real Chrome via
  Claude in Chrome. Point it at an issue, PR, branch or a plain description; it
  builds a Do/Expect plan from the brief, spec or PR checklist, confirms it
  with you, runs the right branch (in a worktree, leaving your tree alone),
  drives the browser while watching console and network, and reports
  PASS/FAIL/BLOCKED with evidence and a recording. Standalone: nothing in the
  delivery flow triggers it. It stops if there is no web UI or no Chrome tools,
  and never reports a pass it did not observe.
- `route` sends "test it in the browser" requests to it.

## [2.1.0] — 2026-10-28

Adapted from upstream `mattpocock/skills` 1.3.1.

### Changed

- **`setup-workflow`**: with no GitHub remote it now wires one up and verifies
  with `gh repo view`; offers to rename a legacy `CONTEXT.md` /
  `CONTEXT-MAP.md` to its `GLOSSARY` name.
- **GitHub operations reference**: closing an issue posts the comment first
  (`close --comment` silently drops it on closed issues); native
  `--blocked-by` flags, an open-blocker count query, and a fork target-repo
  check.

## [2.0.0] — 2026-10-28

Major: the plugin's primary flow is now **grill once, deliver without a
human**. Adapts Matt Pocock's skills (MIT; `THIRD_PARTY_NOTICES.md`).

### Added

- **`work` skill + `/work`**: the new entry point. Intake → grill → spec and
  tickets → handoff gate → hand over (cloud or local).
- **`intake`, `grill`, `spec-and-tickets`, `handoff-gate`, `deliver` skills.**
  `deliver` builds on one integration branch from main, one `--t<n>` branch
  and PR per subtask merged into it, and a single final PR to main.
- **Autonomous mode** (`TEAM_AUTONOMOUS=1`): the git guard lets an agent
  push feature/subtask branches and merge PRs *into* them, and blocks any push
  or merge to main/master and `gh pr merge --admin`. Fails closed when a PR's
  base cannot be resolved. `commit-changes`, `push-branch` and `open-pr` skip
  their ask-gate only in this mode, only under `deliver`.
- References: `workflow-labels.md`, `agent-brief.md`,
  `issue-tracker-github.md`, `autonomous-mode.md`.
- `/deliver` command.
- **`route` skill + `/go`**: the front door. Reads the request, the repo and
  issue labels; picks the right skill or flow (including resuming an
  interrupted `deliver`), announces why, and runs it.
- **Adapted AI Hero skills (MIT):** `triage` (+ `/triage`), `wayfinder`,
  `prototype`, `research`, `retro`, `codebase-design`, `improve-architecture`,
  `domain-modeling`, `handoff`, `wait-what`, `to-questionnaire`, `wizard`,
  `writing-for-agents`, plus `setup-workflow`.
- **Workflow nudge (SessionStart hook):** every session in a git repo is told
  to route task requests through `route`/`work` before writing code, scoped so
  plain questions are answered directly. The `project-context` skill and the
  `CLAUDE.md` template carry the same line, so the entry point is stated, not
  merely hoped for from skill-description matching.
- `references/code-smells.md` (Fowler smell baseline).

### Improved

- **`diagnose`**: feedback-loop-first (tight, red-capable, deterministic,
  fast), minimization, ranked falsifiable hypotheses, tagged instrumentation,
  seam-or-finding, cleanup — plus the existing root-cause, siblings, blast
  radius.
- **`implement`**: pre-agreed seams, vertical slices, no tautological tests,
  verify through the interface, mock only at system boundaries.
- **`review-changes`**: parallel Standards and Spec axes with the smell
  baseline, alongside `/code-review`, security routing and the principles pass.
- **`pr-description`**: smallest-visual summary, before/after evidence,
  one-way/two-way door and blast radius; autonomous PR sections.

### Changed

- **Breaking:** `/feature` and `/bug` now run `work` instead of
  `feature-ticket` / `bug-ticket`, which remain as the attended
  single-session path (name them directly).
- Stale-`CLAUDE.md` push reminder is skipped in autonomous mode; `deliver`
  refreshes it once at the end.

## [0.8.1] — 2026-08-16

### Fixed

- **`ux-audit`: four gaps found by dogfooding on a real project.**
  - Stage 1 now checks the project's decision log (`docs/adr/` or equivalent)
    for a prior visual/component-strategy decision before proposing one — a
    recorded ADR always wins over the skill's own defaults.
  - Stage 1 now reads a sample of existing UI tests to state upfront whether a
    visual-only pass is test-safe (asserts on `data-testid`/ARIA/text) or not
    (asserts on CSS classes/DOM structure).
  - Design-system changes (plan section 8) now call for visual tokens as
    runtime CSS custom properties, not compiled-in values, whenever the
    product is or will be multi-tenant/white-labeled.
  - New Stage 6 self-check before the plan is finalized: verify code samples
    against the target framework's actual semantics and re-read the plan
    end-to-end for internal contradictions, so a wrong snippet doesn't ship
    looking authoritative.

## [0.8.0] — 2026-08-15

### Added

- **`ux-audit` skill.** A read-only UX audit for existing products with a real
  UI surface: gates on whether a UI surface actually exists (refuses to
  fabricate screens or a design system for a CLI/library/API-only repo), audits
  the current UI with cited evidence, prioritizes P0–P3, and writes a
  screen-by-screen, file-level `docs/ui-ux-implementation-plan.md` that
  `feature-ticket` can execute. Explicitly refuses generic templates
  (sidebar+cards+charts) in favor of layouts derived from the actual user
  workflow.

## [0.7.0] — 2026-08-08

The 0.6.0 release wrote down rules that a build had proven the *prose* version
of `review-changes` still missed. Continuing to use those rules on a second,
parallel build (a school ERP plus its first frontend) surfaced a sharper
problem: prose is advice, and advice can always be told "just skip it" —
including by the person who wrote the request. Everything below moves what can
be moved from something Claude is asked to follow into something a hook
actually enforces, and closes four places where a rule existed but nothing
ever triggered it.

### Added

- **A code-quality guard that blocks the write, not just the commit.** A new
  `PreToolUse` hook on `Write`/`Edit`/`MultiEdit` refuses `any`, silenced
  linter/type checks, swallowed errors, untracked `TODO`s, disabled tests, and
  a gate being weakened — mechanically, before the file is written. Every rule
  carries an escape hatch (`// why: <reason>`) because a guard with no way
  through gets uninstalled and then protects nothing; writing the reason down
  is what turns a shortcut into a recorded decision.
- **The guard escalates instead of refusing forever.** First refusal explains
  the rule; second names what ignoring it tends to cost; a third attempt on the
  same rule in the same file is let through — and logged to
  `.claude/engineering-overrides.md` with a timestamp, so persistence can win
  but never silently. That file is itself a reading list: a cluster of
  overrides on one rule is evidence the rule may be wrong for the project, not
  only that the code is.
- **Built against real code before trusting it.** The first draft, run over a
  277-file production repository, produced 43 findings — mostly false
  positives: it read doc comments as offending code, and judged a config file's
  new text with no way to know whether a number had gone up or down. Rebuilt to
  ignore comment bodies for the rules that aren't about comments, and to compare
  a threshold against what it *replaced*, not what it now reads. Second run: 18
  findings, all real.
- **Pushing no longer outruns `CLAUDE.md`.** A `git push` when the context has
  drifted (stale fingerprint, or none at all) is blocked once per session with
  the specific reason and the fix — not on every subsequent push, which would
  make the rule the kind of obstacle that gets disabled. `feature-ticket` and
  `bug-ticket` now refresh context as part of the commit that changes what's
  true, rather than leaving it to be discovered later by this hook.
- **`review-changes` looks outside the diff.** Every existing check judges what
  changed, and duplication of a *rule* accumulates one clean diff at a time —
  no single diff among three ever looked like the offender. Found this way on
  the same build: eight services independently re-deriving "entity refusal →
  field-level validation error," and three screens independently re-deriving a
  loading/saving/error triple. The fix is extraction in the same round, not a
  note for later.
- **`adr`: silence is a decision too.** An ADR that names a framework and stays
  quiet on everything else reads, to the next person, as though the rest was
  decided the same deliberate way. The trigger is now explicit: the second or
  third instance of something in a category an ADR should own, with no ADR
  covering it, is the moment to write or amend one — wired into both
  `brainstorm` and `review-changes` step 6, since those are where the pattern
  is already being looked at.
- **`principles-audit` has stated triggers.** It existed and nothing ever fired
  it. Now named explicitly: a round number of shipped tickets, visible growth
  in `engineering-overrides.md`, a structural change to the project, before
  handing the codebase to someone who wasn't there for the decisions.
- **`engineering-principles`: a frontend reference.** Component extraction at
  the third caller (not the first, not never); server state and client state
  are different problems with different defaults, and neither is "reach for a
  global store"; accessibility made structural through shared primitives
  rather than remembered per screen. Written after watching a real frontend
  accumulate three copies of the same form-field wiring and reach for
  `useState` for data the server, not the client, owns.
- **Plain-language rule for every question a skill asks the user.**
  `brainstorm` now requires every tradeoff to be translatable into its
  real-world consequence before it is asked — "should the second clerk see an
  error or wait and retry" instead of "optimistic or pessimistic locking." If a
  tradeoff can't be phrased that way, it hasn't been understood well enough to
  ask about yet. `bootstrap-project`'s Stage 0 questions were rewritten under
  the same rule.
- **The PR's human-verification section asks two different questions of two
  different people.** It previously asked one signer to both "verify the
  behavior" and "read the full diff" — the second is not something a
  non-engineer driving a change can honestly check. Split into what anyone who
  used the feature can attest to, and a separately named code review that an
  engineer has to have actually done; a checked behavior box no longer stands
  in for one.

### Fixed

- **The guard's own pattern matching blocked writing tests about it.** A test
  fixture containing the literal text of a forbidden flag, inside a heredoc,
  read as the command itself. Command text is now distinguished from heredoc
  bodies being written as data — except where the heredoc *is* the thing being
  inspected (a commit message), which the trailer check still reads.

## [0.6.0] — 2026-08-04

Everything here comes from one long build: a multi-tenant school ERP taken from
a walking skeleton to fourteen migrations and ~1400 tests. The rules that
already existed held up well. These are the gaps the build found — most of them
places where a principle was written down but nothing ever *checked* it.

### Added

- **`review-changes` now checks cost at scale.** `operability.md` has said
  "never do slow work in a request handler" from the start, and a handler
  shipped that made one email call per absent child, sequentially, inside the
  request. The rule was not missing; the review step that would have caught it
  was. The check now asks you to walk the loop out loud with a realistic count.
- **`review-changes` now checks authorization blast radius.** Naming which
  roles hold a permission, and the widest damage a holder can do, catches the
  case where an action is gated on a related-sounding permission: school-wide
  parent messaging behind `attendance:mark`, which every teacher holds so they
  can mark their own class.
- **`testing.md`: never set up state the application could not produce.** An
  end-to-end test wrote past a `CHECK` constraint to force a scenario, and in
  doing so hid the fact that the real path could never reach it — the feature
  under test could reach no one at all. If the setup is impossible through the
  application, that is the finding.
- **`testing.md`: isolate database tests by construction.** Per-test
  transaction rollback rather than cleanup in a teardown hook. A cleanup hook
  in that project failed silently for 110 runs; the symptom, when it finally
  appeared, was a *different* test failing in a way that looked like a product
  bug. Shared databases also turn unique constraints into undeclared couplings
  between tests.
- **`testing.md`: commit a runnable scenario script when the real consumer does
  not exist yet.** The whole path — provision, authenticate, do the day's work,
  read it back — got walked by hand a dozen times during that build. Committing
  it makes each repetition free and gives the eventual UI a specification of
  the flow.
- **`project-rules`: the third occurrence of a bug class becomes a gate.** One
  driver-binding mistake was fixed three times, twice with a helper and a
  comment explaining it. A recurring mistake that keeps being fixed by hand is
  a missing rule, and every repetition is evidence somebody's memory is
  load-bearing.
- **`adr`: an accepted ADR is not an exemption from YAGNI.** "The architecture
  keeps X possible" is a reason not to close a door, not a reason to build the
  door, the frame and the hinges. Five extraction seams got built for a
  single-process product because an ADR permitted them. Also: revisit the log
  when its assumptions move, not only when a stated trigger fires.

### Changed

- **`testing.md` is franker about coverage ratchets.** Once the number is the
  target, the cheapest way to hit it is a test that runs a line and asserts
  nothing — and a 100% ratchet makes that pressure constant. Named the
  antipattern (constructing type-violating inputs to reach a defensive
  `throw`), and said what to do instead: usually delete the line, because a
  branch no caller can reach is dead code wearing a safety costume.

## [0.5.1] — 2026-07-31

### Security

- The shipped gitleaks config no longer allowlists whole file types. Markdown
  (`.md`), test files (`.test.` / `.spec.`) and `fixtures/` were excluded, so
  the scanner ignored the places secrets most often hide — connection strings
  pasted into ADRs and `CLAUDE.md`, and credentials hardcoded "just for the
  integration test". Measured against identical fixtures, the old config found
  1 of 4 planted secrets; the new one finds all 4.
- Documented and handled the config **filename**: gitleaks only auto-loads
  `.gitleaks.toml`. Every doc previously said to copy it to `gitleaks.toml`,
  which gitleaks silently ignores in favour of its defaults. The pre-commit
  hook now passes `--config` explicitly so either name works.

### Changed

- The release flow now lives in one place: `.claude/skills/ship-change/` is
  canonical, and the README links to it rather than repeating the version-bump
  and rollback detail.
- `bootstrap-project` now tells projects to commit the gitleaks config as
  `.gitleaks.toml`.

### Added

- This changelog.

## [0.5.0] — 2026-07-31

First release under the current workflow. Plugin went from a git-workflow
helper to the team's full engineering workflow, and stopped assuming
JavaScript.

### Added

- **`engineering-principles`** — the standards canon: no-patchwork doctrine,
  SOLID, DRY, the dependency rule, typed errors, with references for OWASP
  security, operability, API/data design, testing strategy and quality
  attributes. `brainstorm`, `implement` and `review-changes` defer to it.
- **`project-rules`** (`/rules`) — turns the canon into a project's enforced
  configuration, ratcheted, recording exceptions scoped/justified/dated.
- **`bootstrap-project`** (`/new-project`) and **`principles-audit`**
  (`/audit`) — greenfield and inherited-codebase paths.
- **`project-context`** (`/context`) — generates `CLAUDE.md` and keeps it
  honest with a fingerprint checked by a new `SessionStart` hook.
- **`adr`**, **`threat-model`**, **`release`**, **`dependency-upgrade`**.
- Commands: `/feature`, `/bug`, `/new-project`, `/audit`, `/rules`,
  `/context`, `/adr`, `/release`.
- A `node --test` suite (115 tests) covering the hooks, the shell templates and
  the validation scripts.
- `check-version-bump` in CI: a PR changing `skills/` or `hooks/` must move the
  plugin version, so teammates never receive new behaviour under an old one.

### Changed

- **Language-agnostic throughout.** Hooks, CI and skills resolve checks through
  a standard task interface (`make` → `just` → ecosystem detection) covering
  JS/TS, Python, Go, Rust, JVM, .NET, Ruby, PHP, Elixir, Swift and Dart,
  including each language's test-file naming.
- CI sets up only the toolchains whose manifests exist and reads coverage from
  Cobertura, so any ecosystem works.
- Marketplace pinning to `stable` made real via the `ref` field — previously
  recommended but not configured anywhere.

### Fixed

- **Break-glass was unusable**: the skill documented a `Justified-Exception:`
  trailer while the hook gated on a `JUSTIFIED_EXCEPTION` env var. The TDD gate
  moved to `commit-msg`, so the trailer is the whole mechanism.
- **CI scanned the wrong tree**: the coverage ratchet checked out the base
  branch and never returned, so the secret scan ran against the base rather
  than the PR. Base coverage now runs in a worktree, cached by base SHA.
- **`.mjs` files were exempt from the TDD gate**, letting an ESM-first project
  opt out entirely.
- Guard-hook holes: `gh pr merge` returned early so a compound command could
  slip a force-push past later checks; segment matching didn't stop at
  newlines; escaped-`\n` trailers collapsed into one match.
- PR labels were interpolated into a CI shell script body.

### Removed

- **`conventional-commits` and `pr-description` are no longer invocable
  skills.** They became references consumed by `commit-changes`, `open-pr` and
  `release`. Behaviour is unchanged; only direct invocation is gone.

## [0.2.0] and earlier

Initial marketplace: TDD-gated workflow skills, conventional commits, PR
descriptions, and the git guard hook. No changelog was kept.

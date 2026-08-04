# Changelog

Notable changes to the `team-skills` plugin. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are the
`version` field in `plugins/team-skills/.claude-plugin/plugin.json`.

**A version only reaches teammates once `stable` is fast-forwarded** — see
[How updates reach you](README.md#how-updates-reach-you).

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

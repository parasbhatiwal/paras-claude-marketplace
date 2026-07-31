# Changelog

Notable changes to the `team-skills` plugin. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are the
`version` field in `plugins/team-skills/.claude-plugin/plugin.json`.

**A version only reaches teammates once `stable` is fast-forwarded** — see
[How updates reach you](README.md#how-updates-reach-you).

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

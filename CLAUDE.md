# paras-claude-marketplace — context for Claude

<!-- claude-context:begin -->
<!-- claude-context: sha=10b3d6525942227d713c3b7c808916476a7c623a generated=2026-10-28 -->

## What this is
A Claude Code plugin marketplace (`parasbhatiwal`) shipping one plugin,
`team-skills`: engineering-workflow skills, slash commands, and git-guard
hooks that run on other developers' machines. "Done" = merged to `main`
**and** fast-forwarded to `stable`, with the plugin version bumped.

## Commands
| Task | Command | Notes |
|---|---|---|
| Test | `npm test` | Node test runner, ~4s, no install step (zero deps) |
| Validate | `npm run validate` | Skill frontmatter, cross-refs, relative file refs, hooks, manifests |
| Lint | `npm run lint` | `node --check` on every `.mjs` |
| All gates | `npm run lint && npm run validate && npm test` | Must be green before a PR |
| Ship | use the repo skill `ship-change` | Branch → bump → PR → merge → ff `stable` |

## Architecture
- `plugins/team-skills/skills/<name>/SKILL.md` — the skills; `commands/` are thin
  entry points; `references/` are shared docs skills point at.
- `plugins/team-skills/hooks/` — pure rule modules (`policy.mjs`,
  `context-freshness.mjs`, `quality.mjs`) + thin I/O wrappers (`guard-git.mjs`,
  `guard-quality.mjs`, `session-context.mjs`). Keep rules pure and testable.
- `examples/` — language-agnostic templates teams copy into their projects.
- `scripts/` — the validator and version-bump check used by CI.
- v2 flow: `work` → `intake` → `grill` → `spec-and-tickets` → `handoff-gate` →
  `deliver`; autonomous behavior documented in `references/autonomous-mode.md`.

## Conventions
- Skill `name` equals its directory; `description` is trigger-shaped, 40–1024 chars.
- Cross-reference skills as "`x` skill"; the validator fails if `x` doesn't exist
  (even inside an attribution sentence). Reference files via explicit `../../references/...`.
- Any change under `hooks/` or `scripts/` needs tests in `tests/`.
- Commits carry two `Co-Authored-By` trailers (human from git config + Claude).

## Gotchas
- **Version bump is silent-fail:** unchanged `plugin.json` version = nobody receives the update.
- **`stable` is the release,** not `main`. Fast-forward only; roll forward, never rewind.
- The installed guard hook runs from the **plugin cache** (an older version), not this
  working tree — hook changes here don't affect your own session until released.
- The guard scans command text: write test fixtures containing forbidden flags in
  heredocs or assemble the string, or the guard blocks your own commit.
- Local Node is newer than CI's Node 20; version-specific breakage shows only in CI.

## Environment
Node >=20. `TEAM_AUTONOMOUS=1` (set by a cloud runtime, never by hand) enables
autonomous mode in the guard. `TEAM_SELF_MERGE_ALLOWLIST` overrides who may self-merge.

## Workflow
This repo uses the team workflow: hand any task to `/go` (the `route` skill)
or `/work` - it grills the requirement first, then delivers; TDD, gated
commits. Don't start coding a task that hasn't been through the grill.
Standards: the `engineering-principles` skill.
<!-- claude-context:end -->

## Team notes

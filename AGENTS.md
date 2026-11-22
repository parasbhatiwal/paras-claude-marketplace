# paras-claude-marketplace — context for agents

<!-- claude-context:begin -->
<!-- claude-context: sha=b6f0d0e0d5cd0397015070525947f6817f0d8465 generated=2026-11-22 -->

## What this is
A Claude Code plugin marketplace (`parasbhatiwal`) shipping one plugin,
`team-skills`: engineering-workflow skills, slash commands, and git-guard
hooks that run on other developers' machines. Codex and Cursor can install the
same skills (best effort; hooks are Claude-only so far). "Done" = merged to `main`
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
  `policy-deps.mjs` builds the git/gh dependencies the policy needs, shared by
  every wrapper. `hook-adapters.mjs`: Cursor/Codex payload adapters (not yet wired
  to a hook; see `references/agent-tool-contracts.md`).
- `examples/` — language-agnostic templates teams copy into their projects.
- `scripts/` — the validator and version-bump check used by CI; `tool-manifests.mjs`
  and `repo-docs.mjs` hold the Codex/Cursor manifest and doc-link rules;
  `neutral-wording.mjs` holds the tool-neutral wording rules; `codex-smoke.mjs` runs the real
  Codex CLI (advisory CI job).
- Tool manifests: Claude `.claude-plugin/`, Codex root `plugin.json` +
  `.agents/plugins/marketplace.json`, Cursor `.cursor-plugin/`. Facts and
  unconfirmed items: `plugins/team-skills/references/agent-tool-contracts.md`.
- Context: this file (`AGENTS.md`) is canonical and read by Claude Code, Codex and Cursor;
  `CLAUDE.md` is only the one-line `@AGENTS.md` import. Never write context into `CLAUDE.md`.
- Docs: `README.md` is the newcomer-facing front door; maintainer flow lives in
  `CONTRIBUTING.md`, per-skill deep dives in `docs/skills-guide.md`. Edit those,
  not README, for detail. CHANGELOG links to README's "How updates reach you" anchor.
- v2 flow: `work` → `intake` → `grill` → `spec-and-tickets` → `handoff-gate` →
  `deliver`; autonomous behavior documented in `references/autonomous-mode.md`.

## Conventions
- Skill `name` equals its directory; `description` is trigger-shaped, 40–1024 chars.
- Cross-reference skills as "`x` skill"; the validator fails if `x` doesn't exist
  (even inside an attribution sentence). Reference files via explicit `../../references/...`.
- Skills stay tool-neutral: Claude-only names (`/code-review`, Claude in Chrome, the Claude
  trailer) go in a `(Claude Code: ...)` note, and the context file is called `AGENTS.md`.
  `validate` enforces both; `browser-verify` and `deliver` are Claude-only by design.
- Any change under `hooks/` or `scripts/` needs tests in `tests/`.
- Commits carry two `Co-Authored-By` trailers: the human (git config) and the agent
  that wrote it, matched by name (Claude, Codex, Cursor; `TEAM_AGENT_TRAILER_NAMES`).

## Gotchas
- **Upstream sync:** `upstream.json` pins the AI Hero version/file hashes we adapted from;
  the weekly `upstream-sync` workflow has an agent adapt changes into one PR (content files
  only, enforced by `scripts/upstream-guard.mjs`). Merging a PR that moves the plugin version
  auto-fast-forwards `stable` via `release-stable.yml`, so the manual step is no longer needed.
  The sync can only open its PR if the repo setting "Allow GitHub Actions to create and approve
  pull requests" is on; when off, the run pushes `upstream-sync/auto`, opens an issue instead,
  and the PR must be opened by hand.
- **Version bump is silent-fail:** unchanged `plugin.json` version = nobody receives the update.
  Bump the Claude, Codex and Cursor plugin manifests to the SAME number; `validate` fails otherwise.
- **`.agents/skills/ship-change` is a symlink** to `.claude/skills/ship-change` (Codex does not read
  `.claude/skills`); `validate` fails on a missing, broken or copied link.
- Cursor and Codex auto-discover `hooks/hooks.json` and `commands/`, which are Claude-format; their
  manifests declare both empty on purpose. Don't remove that without shipping real hooks for them.
- **`stable` is the release,** not `main`. Fast-forward only; roll forward, never rewind.
- The installed guard hook runs from the **plugin cache** (an older version), not this
  working tree — hook changes here don't affect your own session until released.
  After the AGENTS.md migration your session still runs an older cached plugin version that
  reads only `CLAUDE.md`: it finds the one-line import, may call the context "unmanaged", and
  the push reminder stays quiet (it fires only for stale or missing). Run
  `/plugin update team-skills@parasbhatiwal` to get the hook that reads `AGENTS.md`.
- The guard scans command text: write test fixtures containing forbidden flags in
  heredocs or assemble the string, or the guard blocks your own commit.
- Local Node is newer than CI's Node 20; version-specific breakage shows only in CI.

## Environment
Node >=20. `TEAM_AGENT_TRAILER_NAMES` (comma list, replaces the default agent names).
`TEAM_AUTONOMOUS=1` (set by a cloud runtime, never by hand) enables
autonomous mode in the guard. `TEAM_SELF_MERGE_ALLOWLIST` overrides who may self-merge.

## Workflow
This repo uses the team workflow: hand any task to `/go` (the `route` skill)
or `/work` - it grills the requirement first, then delivers; TDD, gated
commits. Don't start coding a task that hasn't been through the grill.
Standards: the `engineering-principles` skill.
<!-- claude-context:end -->

## Team notes

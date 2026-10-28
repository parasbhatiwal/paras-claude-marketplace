---
name: ship-change
description: Use this skill for ANY change to this marketplace repo - editing a skill, hook, reference, template, script, or doc ("change this skill", "fix the hook", "add a skill", "ship this", "release it"). Drives the full path from branch to teammates receiving the update, including the two steps that fail silently - the plugin version bump and the stable fast-forward.
---

# Ship a change to this marketplace

Every change to this repo runs on other developers' machines. This skill is the
whole path from edit to delivery. Follow it in order; do not compress it.

**The two steps that fail silently** — and are therefore the point of this
skill:

1. **The version bump.** Claude Code skips a plugin update when the resolved
   `version` string is unchanged. Ship a fixed skill without bumping it and
   nobody receives it — no error, no warning.
2. **The `stable` fast-forward.** Users pin the marketplace to `@stable`.
   Merging to `main` publishes *nothing*.

## Stage 0 — Branch

Never edit `main` directly.

```sh
git checkout main && git pull --ff-only
git checkout -b <type>/<slug>          # feat/, fix/, docs/, chore/
```

## Stage 1 — Change

- **Skills** live in `plugins/team-skills/skills/<name>/SKILL.md`; keep the
  frontmatter `name` identical to the directory and the `description`
  trigger-shaped ("Use this skill when…", 40–1024 chars).
- **Shared references** go in `plugins/team-skills/references/`; a skill points
  at them with a path relative to its own directory — up two levels, then the
  references directory and filename — so the validator can verify it resolves.
  Write it explicitly relative (starting with two dots), never as a bare
  project path, or the check silently skips it.
- **Hooks**: rules belong in the pure module (`policy.mjs`,
  `context-freshness.mjs`), I/O in the wrapper. Keep them separable — that
  split is what makes them testable.
- **Templates** in `examples/` must stay language-agnostic: resolve tooling
  through the task interface in `examples/githooks/_lib.sh`, never assume npm.

## Stage 2 — Tests (not optional)

Any change under `plugins/**/hooks/` or `scripts/` needs tests in `tests/`.
This repo enforces TDD on every project it touches; it is held to the same
rule. Shell templates are tested by driving the real hook against a throwaway
git repo — see `tests/githooks.test.mjs` and `tests/task-hooks.test.mjs`.

Prose-only changes (a skill's wording, a reference, a doc) need no test, but
must still pass the validator.

## Stage 3 — Bump the version

Edit `plugins/team-skills/.claude-plugin/plugin.json`.

| Bump | When |
|---|---|
| **patch** | Wording, clearer instructions, a hook bugfix with no behavior change |
| **minor** | A new skill or command; a new gate that only warns |
| **major** | A skill or command removed/renamed; a gate that now blocks what it used to allow |

Pre-1.0, breaking changes go in the **minor**. Skip this stage **only** when
nothing under `plugins/` changed — CI's `check-version-bump` fails the PR when
a bump was required.

## Stage 4 — Verify locally

```sh
npm run lint && npm run validate && npm test
```

If shell templates changed and `shellcheck` is installed:

```sh
(cd examples/githooks && shellcheck -s sh -x _lib.sh commit-msg pre-commit pre-push)
```

All three must be green before the PR. Never claim a check passed without
running it.

## Stage 5 — Commit

Use the `commit-changes` skill. One logical change per commit — split when the
work spans unrelated concerns. Every commit needs both trailers:

```
Co-Authored-By: <human name> <human email>
Co-Authored-By: Claude <noreply@anthropic.com>
```

`git mv` stages renames immediately, so stage deliberately (`git add <paths>`)
or an unrelated rename lands in the wrong commit.

## Stage 6 — PR and CI

`push-branch`, then `open-pr` (both ask first). Wait for `validate` to go
**green** — check that the tests actually ran, not merely that the job passed;
a run that collects zero tests can still exit 0 elsewhere.

CI is the only place Node 20 is exercised. Local Node is newer, so
version-specific breakage surfaces here and nowhere else.

## Stage 7 — Merge and PUBLISH

The `release-stable` workflow fast-forwards `stable` by itself after a merge to
`main` that moved the plugin version. With Actions healthy, merge, wait for it,
then only verify (`git rev-parse --short origin/main origin/stable`). With
Actions unavailable (billing, outage), or if the refs do not match, do it by
hand:

```sh
gh pr merge <n> --merge          # merge commit; preserves the logical commits
git checkout main && git pull --ff-only
git checkout stable
git merge --ff-only main
git push origin stable           # ← this is the release
```

Then delete the merged branch. Confirm both refs match:

```sh
git rev-parse --short origin/main origin/stable
```

## Stage 8 — Report

Tell the user: the version shipped, what teammates will receive, and how.
Background auto-update reaches SSH-cloned marketplaces; HTTPS clones of this
private repo update unreliably and may need
`/plugin marketplace update parasbhatiwal` + `/plugin update team-skills@parasbhatiwal`.

## Rolling back

`stable` is fast-forward-only — **roll forward, never rewind**. Revert on a
branch, bump the version again, merge, fast-forward. Force-pushing `stable`
backwards leaves everyone on the bad version with no version change to correct
them.

## Upstream AI Hero sync (automated)

Many skills are adapted from Matt Pocock's `skills` repo (MIT). Weekly, the
`upstream-sync` workflow diffs upstream against the baseline in
`upstream.json`; on changes an agent adapts them, the workflow bumps the
plugin's minor version, refreshes the baseline, and opens ONE PR
(`upstream-sync/auto`). The agent is confined to content files
(`scripts/upstream-guard.mjs`): hooks, scripts, tests, workflows and
repo-level skills are out of reach. **Review that PR as prose** — look for
lost adaptations (autonomous mode, brief contract, labels) — then merge it;
`release-stable` fast-forwards `stable` automatically when the version moved.
If the agent fails, the report lands in an issue instead; port by hand and
refresh the baseline with `node scripts/upstream-diff.mjs <checkout>
--write-baseline` in the same PR. Needs the `ANTHROPIC_API_KEY` secret.

## Rules

- No direct commits to `main` or `stable`.
- Never weaken a gate to make CI pass; fix the cause.
- A change to `plugins/` that reaches `main` without reaching `stable` is not
  shipped — finish the flow or say plainly that it is unpublished.
- Skills are prose that other people's sessions execute: state rules, not
  suggestions, and keep the roster lean rather than adding a near-duplicate.

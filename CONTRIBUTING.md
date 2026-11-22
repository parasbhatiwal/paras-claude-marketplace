# Contributing

Thanks for your interest. This repo is a Claude Code plugin marketplace: what
you change here runs on other developers' machines, so changes go through a
short, strict flow. Small fixes (typos, wording, a clearer skill description)
are very welcome as plain PRs.

Prerequisites: Node >= 20 (CI runs Node 20), `git`, and the GitHub CLI.
There is nothing to `npm install` — the repo has zero dependencies.

Ask Claude to **"ship this change"** and the repo-level `ship-change` skill
(in `.claude/skills/`) drives the whole flow below. It exists because two of
these steps fail *silently* — nothing errors, the change just never arrives.

## The flow

```
1. branch        git checkout -b feat/<slug>          never edit main directly
2. change        skill / hook / reference / template
3. test          tests/ — required for any .mjs change
4. BUMP VERSION  plugins/team-skills/.claude-plugin/plugin.json    ← silent if skipped
5. verify        npm run lint && npm run validate && npm test
6. PR            gh pr create  →  validate must be green
7. merge         gh pr merge --merge                  main updated, users unaffected
8. PUBLISH       automatic: release-stable fast-forwards stable when the version moved
                 (manual fallback if Actions is down: git checkout stable,
                 git merge --ff-only main, git push origin stable)
9. confirm       both refs must match: compare origin/main and origin/stable
```

Skip steps 4 and 8 only when nothing under `plugins/` changed (a repo-level
skill, a script, this README); `release-stable` skips itself in that case. CI's `check-version-bump` fails the PR whenever
the bump was actually required.

**`.claude/skills/ship-change/SKILL.md` is canonical** for the details this
summary deliberately omits — how to size the version bump, what to do about a
bad release, and the gotchas (`git mv` staging renames early; CI being the only
place Node 20 runs). Ask Claude to *"ship this"* and it follows that file; it is
not repeated here so the two cannot drift apart.

## What CI checks

Three workflows run here. `upstream-sync.yml` (weekly) and `release-stable.yml`
(on merge) are described in [the v2 workflow](docs/skills-guide.md#the-v2-workflow-grill-once-deliver-without-you)
and `ship-change`. `validate.yml` runs on every PR: syntax-checks the scripts, shellchecks the
shell templates, runs the validator (manifests, frontmatter, every referenced
skill exists, every explicitly-relative reference resolves, plugin names
agree, `.claude/skills/` held to the same bar), runs the full test suite, and
fails the PR if `skills/` or `hooks/` changed without a version bump.

CI is the **only** place Node 20 is exercised — local Node is newer, so
version-specific breakage surfaces there and nowhere else.

Released versions and what changed in each: [`CHANGELOG.md`](CHANGELOG.md).

## Repo protection

The repo is public and protected with two rulesets:

- **`main`:** changes need a pull request and a green `validate`; force-push and
  deletion are blocked. Only a repo admin can bypass (for example for a bot PR
  that cannot trigger `validate`).
- **`stable`:** force-push and deletion are blocked, so it can only move
  forward. Only collaborators with write access can push to it; keep that
  list to the maintainers.

First-time outside contributors need approval before workflows run on their
PRs. Upstream sync setup: a `CLAUDE_CODE_OAUTH_TOKEN` secret (from
`claude setup-token`, set by hand) and "Allow GitHub Actions to create and approve
pull requests" turned on in Settings → Actions → General.


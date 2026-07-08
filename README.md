# Paras Claude Marketplace

Central marketplace for the team's Claude Code workflow. Skills, hooks, and
project templates are authored **here once**; every project and developer that
enables this marketplace picks up updates automatically.

## What's inside

```
.claude-plugin/marketplace.json     # marketplace index
plugins/team-skills/
  .claude-plugin/plugin.json
  skills/                           # the team workflow (see below)
  hooks/                            # Claude-session git guard
scripts/validate-skills.mjs         # repo validator (runs in CI)
.github/workflows/validate.yml      # blocks bad skills/manifests from shipping
examples/                           # per-project templates (hooks, CI, settings)
CODEOWNERS
```

## The workflow

Two orchestrators drive everything; each stage is its own atomic skill:

- **`feature-ticket`**: brainstorm → TDD implement (per chunk) → review →
  gated commit → push → PR
- **`bug-ticket`**: diagnose (failing repro test) → TDD fix → review →
  gated commit → push → PR

Atomic skills (usable standalone): `brainstorm`, `implement`, `run-tests`,
`review-changes`, `commit-changes`, `push-branch`, `open-pr`, `diagnose`,
plus format helpers `conventional-commits`, `pr-description`.

### Enforced team policy

- **TDD** — no production code without a failing test first; blocked at
  pre-commit and by CI diff-coverage (≥90% changed lines) + coverage ratchet.
- **Attribution** — every commit carries BOTH `Co-Authored-By:` trailers
  (human + Claude); enforced by the Claude session hook, the committed
  `commit-msg` git hook, and the `commit-policy` CI check.
- **Green to ship** — full suite passes before commit and push.
- **No `--no-verify`** — break-glass is a `Justified-Exception:` trailer,
  audited in CI, requiring a `break-glass`-labeled PR approval.
- **Ask-first git writes** — commit, push, and PR always require explicit
  user approval.
- **Human accountability** — PRs need human review + a filled
  Human-verification section.

## Adding or changing a skill

1. Branch, edit `plugins/team-skills/skills/<name>/SKILL.md`.
2. `node scripts/validate-skills.mjs` locally.
3. Open a PR — `validate.yml` must be green, CODEOWNERS review required.
4. Merge to `main`, then fast-forward `stable`:
   `git checkout stable && git merge --ff-only main && git push`.

Projects should pin to **`stable`** so a bad merge to `main` never reaches the
team instantly.

## Onboarding a developer / a project

See [`examples/ONBOARDING.md`](examples/ONBOARDING.md). Short version:
- Dev: one JSON block in `~/.claude/settings.json`, once, covers all projects.
- Repo: copy `examples/` templates (githooks, workflows, settings, gitleaks),
  run `setup-git-hooks.sh`, enable branch protection (require `ci` +
  `commit-policy` + 1 review), enable Dependabot.

## Repo protection (maintainers, one-time)

- Protect `main`: require PR, `validate` check, CODEOWNERS review.
- Keep `stable` fast-forward-only from `main`.

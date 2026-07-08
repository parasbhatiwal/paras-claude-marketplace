# Team Claude workflow — developer onboarding

One-time setup, ~2 minutes. After this, every project you open has the team
skills, and the guardrails travel with you.

## 1. Enable the team plugin (once, covers ALL your projects)

Merge this into `~/.claude/settings.json` (create the file if it doesn't
exist):

```json
{
  "extraKnownMarketplaces": {
    "parasbhatiwal": {
      "source": {
        "source": "github",
        "repo": "parasbhatiwal/paras-claude-marketplace"
      }
    }
  },
  "enabledPlugins": {
    "team-skills@parasbhatiwal": true
  }
}
```

You need normal git access to the (private) marketplace repo — your existing
GitHub SSH key or token is enough. Verify: open Claude Code anywhere and run
`/plugin` — `team-skills@parasbhatiwal` should show as enabled.

## 2. Per-repo setup (once per clone, usually already done)

```sh
sh setup-git-hooks.sh    # points git at the committed .githooks/
```

New repos from the team starter already include hooks, CI workflows, and
settings. For an older repo, copy from the marketplace `examples/` directory:
`githooks/ → .githooks/`, `github-workflows/ → .github/workflows/`,
`project-settings.json → .claude/settings.json`, `gitleaks.toml`.

## 3. How you work now

| You want to | Run |
|---|---|
| Build a feature | `feature-ticket` skill — brainstorm → TDD → review → commit → push → PR |
| Fix a bug | `bug-ticket` skill — failing repro test → fix → review → commit → push → PR |
| Just think through a design | `brainstorm` |
| Just commit | `commit-changes` (runs all gates, asks before committing) |

## The rules (enforced, not optional)

- **TDD**: failing test first; source changes without tests are blocked at
  pre-commit AND in CI (diff coverage ≥ 90% on changed lines).
- **Attribution**: every commit needs BOTH `Co-Authored-By:` trailers — you
  and Claude. The `commit-changes` skill writes them for you.
- **Green to ship**: full suite must pass to commit and to push.
- **No bypasses**: `--no-verify` is blocked. The escape hatch is a
  `Justified-Exception: <reason>` trailer (hotfix / generated / docs-only /
  dep bumps only) — it's audited in CI and the PR needs a `break-glass`
  labeled approval.
- **Humans stay accountable**: PRs require a human review (no self-approval)
  and the Human-verification section filled in by YOU, not Claude.
- **Merging**: you don't merge your own PRs — a teammate does. (Exception:
  the owner account `parasbhatiwal` may self-merge their own PRs.)

## Troubleshooting

- `/plugin` doesn't show the plugin → check `~/.claude/settings.json` JSON is
  valid, and that `git ls-remote git@github.com:parasbhatiwal/paras-claude-marketplace`
  works.
- Commit blocked unexpectedly → read the hook's message; it names the gate.
  If the gate is wrong (e.g. a generated file counted as source), fix the
  glob list in `.githooks/pre-commit` via a PR — don't bypass.

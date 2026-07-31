# Team Claude workflow — developer onboarding

One-time setup, ~2 minutes. After this, every project you open has the team
skills, and the guardrails travel with you.

## 0. Prerequisite: repo access

This marketplace repo is **private**. Before anything below works you need to
be added as a GitHub collaborator (or org member) with at least read access
to `parasbhatiwal/paras-claude-marketplace`, and have working git credentials
(SSH key or `gh auth login`) — Claude Code shells out to git to fetch the
marketplace.

## 1. Add the marketplace and install the plugin

Inside any Claude Code session, run:

```
/plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable
/plugin install team-skills@parasbhatiwal
```

The `@stable` suffix pins you to the `stable` branch, which only ever
fast-forwards from a reviewed `main`. Drop it only if you deliberately want to
track `main`.

This opens an interactive scope picker — choose the scope that matches what
you want:

- **User scope** — installs for you, across every project you open. Writes
  to `~/.claude/settings.json` for you; nothing to hand-edit.
- **Project scope** — installs for everyone who collaborates on the repo you
  currently have open. Writes `extraKnownMarketplaces` +
  `enabledPlugins` into **that project's own** `.claude/settings.json`.
  Commit that file so it ships with the repo — teammates who clone it get a
  one-time "trust this folder?" prompt, then the plugin auto-enables.
- **Local scope** — installs for you, but only in the current repo (not
  shared, not committed).

Run `/reload-plugins` afterward to activate it in your current session.
Verify anytime with `/plugin` → **Installed** tab, or `/plugin list`.

### Scripted / non-interactive equivalent

For setup scripts or CI, skip the picker with the CLI form and an explicit
`--scope`:

```sh
claude plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable
claude plugin install team-skills@parasbhatiwal --scope user      # per-developer, all projects
claude plugin install team-skills@parasbhatiwal --scope project   # shared, this repo only
```

### Manual JSON (equivalent to user or project scope above)

If you'd rather edit config directly instead of using the commands, merge
this into `~/.claude/settings.json` (user scope) or the project's
`.claude/settings.json` (project scope, then commit it):

```json
{
  "extraKnownMarketplaces": {
    "parasbhatiwal": {
      "source": {
        "source": "github",
        "repo": "parasbhatiwal/paras-claude-marketplace",
        "ref": "stable"
      }
    }
  },
  "enabledPlugins": {
    "team-skills@parasbhatiwal": true
  }
}
```

## 2. Per-repo setup (once per clone, usually already done)

```sh
sh setup-git-hooks.sh    # points git at the committed .githooks/
```

New repos from the team starter already include hooks, CI workflows, and
settings. For an older repo, copy from the marketplace `examples/` directory:
`githooks/ → .githooks/` (including `_lib.sh` — the others source it),
`github-workflows/ → .github/workflows/`,
`pull_request_template.md → .github/`,
`project-settings.json → .claude/settings.json`, `gitleaks.toml`, and
`Makefile.template → Makefile` if the repo is polyglot or a monorepo.

The hooks work in **any** language: they resolve `lint`, `typecheck`, `test`
and friends through `make`/`just` targets first, then by detecting your
ecosystem. Nothing assumes npm. Run `/rules` and Claude will wire the gates up
for your stack.

## 3. How you work now

| You want to | Run |
|---|---|
| Build a feature | `/feature <ticket>` — brainstorm → TDD → review → commit → push → PR |
| Fix a bug | `/bug <report>` — failing repro test → fix → review → commit → push → PR |
| Start a new project | `/new-project <what you're building>` — architecture + guardrails before features |
| Assess an inherited project | `/audit` — scored report + phased remediation plan, no code changes |
| Set up or refresh CLAUDE.md | `/context` — scans the repo, keeps your own notes intact |
| Make the standards enforceable here | `/rules` — formatter, lint, strict types, boundaries, coverage, security gates |
| Record a decision | `/adr <decision>` |
| Cut a release | `/release` — version from commits, changelog, tag, publish |
| Just think through a design | `brainstorm` |
| Check a design is safe | `threat-model` (auth, payments, PII, uploads, tenancy) |
| Handle dependency updates | `dependency-upgrade` |
| Just commit | `commit-changes` (runs all gates, asks before committing) |

Standards for all of it live in the `engineering-principles` skill — read it
once; Claude consults it on every design, implementation, and review.

## The rules (enforced, not optional)

- **TDD**: failing test first; source changes without tests are blocked by the
  `commit-msg` hook AND in CI (diff coverage ≥ 90% on changed lines).
- **Attribution**: every commit needs BOTH `Co-Authored-By:` trailers — you
  and Claude. The `commit-changes` skill writes them for you.
- **Green to ship**: full suite must pass to commit and to push.
- **No bypasses**: `--no-verify` is blocked. The escape hatch is a
  `Justified-Exception: <reason>` trailer in the commit message (hotfix /
  generated / docs-only / dep bumps only). Adding that trailer is the whole
  mechanism — no flag, no env var. It's audited in CI and the PR needs a
  `break-glass` labeled approval.
- **Humans stay accountable**: PRs require a human review (no self-approval)
  and the Human-verification section filled in by YOU, not Claude.
- **Merging**: you don't merge your own PRs — a teammate does. (Exception:
  the owner account `parasbhatiwal` may self-merge their own PRs.)

## Troubleshooting

- `/plugin` doesn't show the plugin → run `/plugin marketplace list` (is
  `parasbhatiwal` registered?) and `/plugin list` (is `team-skills@parasbhatiwal`
  installed/enabled?). If the marketplace is missing, re-run
  `/plugin marketplace add parasbhatiwal/paras-claude-marketplace@stable`.
- Marketplace add/install fails → you likely lack repo access. Check
  `gh auth status` and that `git ls-remote git@github.com:parasbhatiwal/paras-claude-marketplace`
  works; ask an owner to add you as a collaborator if not.
- Commit blocked unexpectedly → read the hook's message; it names the gate.
  If the gate is wrong (e.g. a generated file counted as source), fix the
  glob list in `.githooks/_lib.sh` via a PR — don't bypass.
- A check reports "not configured for this project" → that task isn't defined
  for your stack yet. Add it to your `Makefile`/`justfile` or install the
  ecosystem's tool, or just run `/rules`.

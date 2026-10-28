# Autonomous mode

`deliver` runs with **no human present** — typically in a Claude Code cloud
session or routine. Everything that asks a person in attended mode must
instead be decided by rule, and the rules must be enforced by something other
than the agent's good intentions.

## How a run knows it is autonomous

The runtime sets `TEAM_AUTONOMOUS=1` in the environment of the cloud session.
- The git guard hook reads it from its own process environment. An agent
  cannot set it by typing it into a command.
- Skills check it with `printenv TEAM_AUTONOMOUS`. This is for behavior only
  (skip the approval prompt); the hook is the actual wall.

Never set `TEAM_AUTONOMOUS` yourself, locally, to skip a prompt.

## What changes

| Attended (default) | Autonomous |
|---|---|
| `commit-changes` asks before committing | Commits on feature/subtask branches without asking; every gate still runs |
| `push-branch` asks before pushing | Pushes feature/subtask branches; **blocked** from main/master |
| `open-pr` asks before creating | Creates subtask PRs (base: feature branch) and the final PR (base: main) |
| Self-merge limited to the owner allowlist | Agent merges its own subtask PRs into the feature branch; **blocked** from merging anything into main/master, and from `--admin` |
| Stale-`CLAUDE.md` push reminder | Skipped; `deliver` refreshes once at the end |

Unchanged in both modes: no `--no-verify`, no force-push to main, no history
rewrites on main, both `Co-Authored-By` trailers, all test/lint/type/secret
gates, the quality guard.

## Cloud session requirements

- `git config user.name` / `user.email` set: the commit guard requires a human
  `Co-Authored-By` trailer alongside Claude's, taken from that identity.
- `gh` authenticated with rights to push branches and open/merge PRs.
- The repo's test/lint toolchain installable in the session image.

## The single human touchpoint

The one PR from the feature branch to main. `deliver` opens it and stops. It
contains a Human verification checklist, the decisions the agent made, and the
subtasks it could not finish.

## Stuck rule

A question the grilling did not answer is never guessed. Label the subtask
`needs-info`, comment the exact question, skip it and everything it blocks,
continue the rest. The final PR lists what was skipped and why.

## Triggering a run

Out of scope for the plugin: the runner is yours. The contract is: start a
cloud session with `TEAM_AUTONOMOUS=1`, the plugin installed, GitHub
credentials able to push branches and open/merge PRs (but with branch
protection on main requiring a human review), and run
`/team-skills:deliver <epic-or-issue-number>`. Natural triggers: a routine
that polls for `ready-for-agent` issues without `agent-working`, or a
label-event workflow that starts the session.

**Protect main on GitHub too.** The hook stops this agent's commands; branch
protection (required reviews, no direct pushes) stops everything else.

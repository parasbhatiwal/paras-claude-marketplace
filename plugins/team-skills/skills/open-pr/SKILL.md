---
name: open-pr
description: Use this skill when raising a pull request. Applies team branch/PR conventions, builds the body in the team's standard structure plus a mandatory Human verification section, and ALWAYS asks the user for approval before creating the PR.
---

# Open PR

Raising a PR is a gated, ask-first action.

## Preconditions

- Branch is pushed (`push-branch` completed) and follows naming:
  `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, etc.
- One ticket/task = one PR. If the branch mixes unrelated work, flag it and
  propose splitting before opening.

## Build the PR

1. **Title**: conventional-commit style, matching the primary change
   (`feat(cart): add quantity stepper`) — format in
   `../../references/conventional-commits.md` (relative to this skill's
   directory).
2. **Body**: build it to the structure in `../../references/pr-description.md`
   (Summary / Changes / Testing / Notes), derived from the real diff against
   the base branch.
3. **Ticket link**: if the task came from a GitHub Issue, add `Closes #<n>`
   (use `gh issue list`/context to confirm the number). If there is no issue,
   skip — do not invent references.
4. **Append the mandatory section** (reviewers reject PRs where it is empty).
   It asks two different questions of two different people on purpose —
   whoever drove the change verifies *behavior*, which needs no ability to
   read code; a second, separately-named person verifies the *diff*, which
   does. Never let a checked behavior box stand in for the code review — they
   are not substitutes for each other:

```markdown
## Human verification

**Did you use it, and does it do what it should?**
- [ ] I ran the affected flow myself and it behaved the way it is supposed to
- What I did, and what I saw: <author fills this in, plainly — "signed up,
  added two items, the total was right" is a complete answer>

**Has this been read by someone who can read code?**
- [ ] A qualified engineer has read the diff (an automated pass such as
  `review-changes` does not satisfy this on its own — see its own note that a
  second round belongs to a human)
- Who, and what they flagged: <or "not yet" — an honest gap is reviewable,
  silence is not>
```

5. If any commit in the branch carries a `Justified-Exception:` trailer, state
   it in the body under Notes and remind that the PR needs a `break-glass`
   review approval.
6. End the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Approval — ALWAYS ask

Show the user: title, full body, base ← head branches, and whether it will be
draft or ready. Ask for explicit approval before running `gh pr create`. The
human-verification checkboxes are for the HUMAN to tick — never pre-check
them.

## After creating

Report the PR URL. Do not merge, approve, or add labels unless the user asks.

## Merge policy (when asked to merge)

- Self-merge is allowed ONLY for accounts on the team's self-merge allowlist
  merging their own PR. The allowlist is owned by the guard hook — its default
  is the owner account, overridden by `TEAM_SELF_MERGE_ALLOWLIST`. Do not
  restate a username here; let the hook decide.
- Any other author's PR must be reviewed and merged by a DIFFERENT person —
  never by its author. If the user asking is the PR author and not on the
  allowlist, decline and point them to a teammate.
- The session guard hook enforces this on `gh pr merge`; do not work around
  a block.

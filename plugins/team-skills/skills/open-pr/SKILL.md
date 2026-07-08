---
name: open-pr
description: Use this skill when raising a pull request. Applies team branch/PR conventions, builds the body with the pr-description skill plus a mandatory Human verification section, and ALWAYS asks the user for approval before creating the PR.
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
   (`feat(cart): add quantity stepper`). See `conventional-commits`.
2. **Body**: build it with the `pr-description` skill (Summary / Changes /
   Testing / Notes), derived from the real diff against the base branch.
3. **Ticket link**: if the task came from a GitHub Issue, add `Closes #<n>`
   (use `gh issue list`/context to confirm the number). If there is no issue,
   skip — do not invent references.
4. **Append the mandatory section** (reviewers reject PRs where it is empty):

```markdown
## Human verification

- [ ] I ran the affected flow locally and verified the behavior myself
- [ ] I read the full diff before requesting review
- What I checked by hand: <author fills this in>
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

- Self-merge is allowed ONLY for the owner account (`parasbhatiwal`) merging
  their own PR.
- Any other author's PR must be reviewed and merged by a DIFFERENT person —
  never by its author. If the user asking is the PR author and not the owner,
  decline and point them to a teammate.
- The session guard hook enforces this on `gh pr merge`; do not work around
  a block.

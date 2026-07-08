---
name: push-branch
description: Use this skill whenever pushing commits to a remote. Re-verifies the test suite is green, checks the branch is safe to push, and ALWAYS asks the user for approval before pushing.
---

# Push Branch

Pushing publishes work to the team. It is a gated, ask-first action.

## Gates

1. **Never push directly to `main`/`master`.** If on the default branch,
   stop and create a feature branch first (`feat/<slug>` or `fix/<slug>`),
   moving the commits onto it.
2. **Suite GREEN.** Re-run the full suite (via `run-tests`) unless it was run
   green in this same working state with no changes since. RED → BLOCK.
3. **Sanity-check what's being pushed.** Show `git log --oneline
   @{u}..HEAD` (or the full branch history for a new branch): every commit must
   carry both required `Co-Authored-By` trailers. A non-compliant commit →
   BLOCK; fix it before pushing (see `commit-changes`).

## Approval — ALWAYS ask

Show the user: target remote/branch, the commit list being pushed, and the
suite verdict. Ask for explicit approval before running `git push`. Never
force-push; never push with `--no-verify`. If the remote rejects the push
(hooks, protection), report the exact error — do not work around it.

## After pushing

Report the pushed branch and commit range. If the flow continues to a PR,
hand off to `open-pr`.

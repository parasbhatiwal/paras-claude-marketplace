---
name: review-changes
description: Use this skill to run one round of code review on the current working diff before committing — after implementation is complete and tests are green. Wraps the built-in /code-review and routes risky diffs through /security-review.
---

# Review Changes

One structured review round on the working diff, before anything is committed.

## Process

1. Confirm there is a diff to review (`git status`, `git diff --stat`). If the
   tree is clean, say so and stop.
2. Confirm the suite is green first (use the `run-tests` skill if its state is
   unknown — it detects the toolchain in any language) — reviewing red code
   wastes a round.
3. **Run the built-in `/code-review` skill** at medium effort on the working
   diff. That is the core of this skill; do not reimplement review logic here.
4. **Security routing:** if the diff touches any of the following, ALSO run the
   built-in `/security-review` skill:
   - auth, sessions, tokens, permissions
   - user input handling, file uploads, redirects
   - dependency changes (package.json, lockfiles)
   - anything near secrets, env vars, or payment/PII data
5. **Principles pass.** Check the diff against the `engineering-principles`
   skill — read the reference for the area the diff touches rather than all of
   them. Specifically:
   - Boundaries hold: no framework/ORM/HTTP import leaking into domain logic
   - External input parsed and validated at the edge; access authorized per
     object, not per route
   - Errors typed and handled — nothing swallowed, no weakened types or tests
   - Duplication of a *rule* (not just of characters); abstraction invented
     for a single caller
   - Outbound calls have timeouts; new config validated at startup
   - **Patch vs. fix**: is this treating the cause, or making a symptom go
     away? A caller-specific branch or a defensive check where an invariant
     belongs is a finding.
6. Layer the team checklist on top of the findings:
   - Every behavior change is covered by a test that was seen failing first
   - No secrets, keys, or `.env` values in the diff
   - No dead code, debug logging, or commented-out blocks left behind
   - Naming and idiom match the surrounding code

## Acting on findings

- Fix all CONFIRMED correctness findings before proceeding — re-running tests
  after each fix.
- For PLAUSIBLE or judgment-call findings, list them for the user with a
  recommendation; let the user decide rather than silently ignoring them.
- After fixes, re-run the full suite (`run-tests`). Green is required to exit
  this skill.

## Exit criteria

State explicitly: findings raised, findings fixed, findings deferred (and
why), and final suite verdict. Only then hand off to `commit-changes`.

This is ONE round by design — endless review loops stall delivery. A second
round happens in the PR, by a human.

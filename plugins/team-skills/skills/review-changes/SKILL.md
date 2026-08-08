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
   - **Cost at scale**: does any request handler do work proportional to the
     number of records, or make more than one call to an external service?
     Walk the loop with a realistic count out loud ("200 absences × one email
     each, sequential, 5s timeout"). Work like that belongs in a job, not a
     handler — the rule is in `operability.md` and is easy to violate while
     following every other rule.
   - **Authorization blast radius**: for each new or changed endpoint, name
     which roles hold the permission and state the widest damage a holder can
     do. Reusing a permission because the *action* is related is how a
     narrow-sounding capability ("mark my class register") becomes a broad one
     ("message every parent in the school").
   - **Patch vs. fix**: is this treating the cause, or making a symptom go
     away? A caller-specific branch or a defensive check where an invariant
     belongs is a finding.
6. **Look outside the diff.** Every rule above judges what changed — and
   duplication of a *rule* accumulates one clean diff at a time. Screen one has
   no duplication; screen three does, and no single diff was ever the one that
   introduced it. A per-diff review structurally cannot see a per-codebase
   property, so make it look on purpose:
   - Name the pattern this diff just added (a shape of error handling, a form
     field wired up by hand, a fetch-loading-error triple, a permission check).
   - `grep`/search the codebase for that pattern. If this diff makes it the
     **third occurrence or more**, that is a finding — even though the diff
     itself is clean. Two real examples found this way in one build: eight
     services each re-deriving "entity refusal → field-level `ValidationError`"
     by hand, and three screens each re-deriving "loading / saving / error"
     state with their own `try/catch`.
   - The fix is extraction, not a note for later — pull the shared helper or
     component out now, in this round, before the third caller becomes a
     fourth. If extraction is large enough to be its own change, say so
     explicitly and treat it as a blocking follow-up, not a someday.
   - If the pattern is a *decision* rather than a helper (a state-management
     approach, an authz model, a framework choice) and nothing in `docs/adr/`
     owns it, that is the "silence is a decision too" trigger in the `adr`
     skill — stop and record it rather than letting the third occurrence
     finish making the decision by accident.
7. Layer the team checklist on top of the findings:
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

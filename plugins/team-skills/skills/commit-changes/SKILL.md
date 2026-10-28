---
name: commit-changes
description: Use this skill whenever committing code. Runs the full team gate (tests, lint, typecheck, test-presence, secret scan), drafts a compliant conventional-commit message with the required Co-Authored-By trailers, and ALWAYS asks the user for approval before committing.
---

# Commit Changes

A commit is a gated action. Run every gate below IN ORDER; any failure blocks
the commit. Never bypass with `--no-verify` — the team's hooks reject it and
CI re-checks everything anyway.

## Gates (all must pass)

1. **Test runner exists.** Discover it (see the `run-tests` skill). If the
   project has no test runner → BLOCK. Tell the user the project needs the
   team testing bootstrap (`../../references/testing-bootstrap.md`, relative
   to this skill's directory) before any commit is possible.
2. **Full suite GREEN.** Run it now (via `run-tests`), even if it was green
   earlier. Any failure → BLOCK, show failures.
3. **Lint + typecheck clean.** Run the project's `lint` and `typecheck` tasks
   — resolved the same way the hooks do (`make`/`just` target, then ecosystem
   detection; see `../../references/toolchains.md`, relative to this skill's
   directory). A task the project genuinely does not define is reported and
   skipped; a defined task that fails → BLOCK.
4. **Test-presence check (scoped).** Inspect the staged diff:
   - Count only *logic* source files. Exempt: test files themselves, generated
     files, lockfiles, migrations, docs, styles/CSS, assets, type-only
     declaration files, and named config entrypoints (`*.config.ts`,
     `vitest.config.mjs`, …). A plain `.mjs`/`.cjs` source file is NOT exempt.
   - If logic source changed but NO test file changed → BLOCK, unless a
     break-glass exception applies (below).
5. **Secret scan.** Run `gitleaks protect --staged` if available; otherwise
   grep the staged diff for obvious patterns (private keys, `AKIA`, bearer
   tokens, `password=`, long base64 blobs in config). Any hit → BLOCK and show
   the offending line.

## Break-glass (gate 4 only)

Applicable ONLY for: hotfixes, generated code, config/docs-only changes,
dependency bumps. When proposing it:
- Add a trailer `Justified-Exception: <specific reason>` to the message. The
  trailer IS the mechanism — the `commit-msg` git hook reads it and waives the
  gate; there is no flag or env var to set, and never `--no-verify`.
- The reason must be non-empty and specific; an empty trailer does not waive.
- Tell the user this commit will be annotated in CI and its PR requires a
  `break-glass`-labeled review approval.
- Break-glass NEVER skips gates 1–3 or 5, and never skips the trailers.

## Message format

Follow `../../references/conventional-commits.md` (relative to this skill's
directory) for type/scope/subject/body. Then the
trailers — BOTH are mandatory on every commit:

```
Co-Authored-By: <human name> <human email>
Co-Authored-By: Claude <noreply@anthropic.com>
```

Fill the human line from `git config user.name` / `git config user.email`.

## Approval — ALWAYS ask (except autonomous delivery)

**Autonomous exception.** If `printenv TEAM_AUTONOMOUS` is `1` and `deliver`
invoked this skill on a feature or subtask branch, there is no one to ask:
run every gate below exactly as normal, then commit without the prompt. A
failed gate still blocks. Anywhere else — including a human running `deliver`
locally — the rule below holds. See `../../references/autonomous-mode.md`.


Before running `git commit`, show the user:
- The gate results (one line each, pass/fail)
- The staged files
- The full proposed commit message

and ask for explicit approval. Never commit without it — even inside an
orchestrator flow, even for tiny changes. If the user edits the message, keep
the trailers intact.

## Rules

- Stage deliberately (`git add <paths>`) — never `git add -A` blindly when the
  tree contains unrelated changes; one logical change per commit.
- Never amend or rewrite history on a shared branch.
- If any gate fails, fix the cause (or ask the user) — do not weaken the gate.

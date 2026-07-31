---
name: dependency-upgrade
description: Use this skill when updating dependencies or triaging automated update PRs ("upgrade dependencies", "bump packages", "handle these Dependabot PRs", "fix this CVE", "we're on an EOL version"). Batches updates by risk, verifies each against the full suite, reads changelogs for breaking changes, and never lets an upgrade through on a red or unverified gate.
---

# Dependency Upgrade

Dependencies are the largest untested surface in most projects: code you did
not write, running with your privileges. Upgrading is routine maintenance —
and a routine supply-chain risk.

Language-agnostic: resolve the install/audit commands via
`../../references/toolchains.md` (relative to this skill's directory).

## Stage 1 — Survey

1. List what is outdated (`npm outdated`, `pip list --outdated`,
   `go list -m -u all`, `cargo outdated`, `bundle outdated`, …).
2. List known vulnerabilities (the project's `security` task).
3. Flag anything **EOL or unmaintained** — no release in 2+ years, archived
   repo, single maintainer with no successor. These are not upgrades, they are
   migrations, and they need their own ticket.
4. Report the picture before touching anything: how far behind, what is
   urgent, what is risky.

## Stage 2 — Batch by risk

Never upgrade everything in one commit — when something breaks you need to
know which bump did it.

| Batch | Contents | Commit shape |
|---|---|---|
| **Security** | Anything fixing a known high/critical CVE | One commit, first, expedited |
| **Patch** | Patch bumps of trusted deps | One batched commit, fine to group |
| **Minor** | Minor bumps | Grouped by package family (e.g. all eslint-*) |
| **Major** | Any major, or anything with a migration guide | **One commit each**, never grouped |

Toolchain/runtime upgrades (Node, Python, Go, JDK versions) are always their
own change with their own verification.

## Stage 3 — Verify each batch

For every batch, in order:

1. Apply the bump with the ecosystem's tool so the lockfile updates properly —
   never hand-edit a lockfile.
2. **Read the changelog** for every major, and skim minors of anything
   security- or behavior-critical. Note deprecations that now warn — a
   deprecation is a scheduled break.
3. Reinstall from the lockfile exactly as CI does (`npm ci`, `uv sync
   --frozen`, `bundle install --deployment`) so you test what CI will get.
4. Run the **full** suite (`run-tests`), plus lint, typecheck, and build. A
   type error after a bump is the upgrade telling you something changed.
5. Exercise the risky paths a test suite may not cover: startup, migrations,
   auth flow, anything the dependency actually powers.
6. Red → do not force it. Either adapt the code (with a test proving the new
   behavior) or pin and record why.

## Stage 4 — Vetting anything new or replaced

Before accepting a replacement dependency: is it maintained, how large is its
transitive tree, what is its license, does it need install scripts or native
builds, and could a small local implementation replace it? Every dependency is
permanent supply-chain surface — see the security reference of the
`engineering-principles` skill.

## Stage 5 — Commit and PR

- One `chore(deps):` commit per batch (`fix(deps):` when it closes a CVE —
  say which). Body: what moved, from → to, and any behavior change observed.
- These commits change no logic source, so the TDD gate does not fire. If a
  bump *did* require code changes, those changes need their own tests as usual.
- Commit through `commit-changes` (full gates, asks first), then `push-branch`
  and `open-pr` as normal. The PR body names the batch, the CVEs closed, and
  what you verified by hand.

## Triaging automated (Dependabot/Renovate) PRs

Do not merge them blind — an auto-merged malicious or broken bump is a
self-inflicted incident.

1. Group them by the batches above; close the ones superseded by a batch.
2. For each: confirm CI is green, read the release notes, check the diff of
   the lockfile for **unexpected transitive additions**.
3. Majors get a human decision and their own verification pass.
4. Anything from a package that recently changed maintainer or publishing
   pattern gets extra scrutiny — that is what a compromised release looks like.

## Rules

- Never merge an upgrade on a red or skipped gate; never `--force`, never
  `--legacy-peer-deps` to make an install "work" without understanding why.
- Never widen a version range to dodge a conflict — pin, then fix the root
  conflict.
- Security batches ship on their own, fast; do not hold them behind a risky
  major.
- Record deliberately deferred upgrades (with the reason and a revisit date) in
  `docs/engineering-rules.md` — a silent "we can't upgrade" becomes a rewrite.
- If an upgrade cannot be verified because the project lacks tests, that is the
  finding: the fix is Phase 0 of `principles-audit`, not a leap of faith.

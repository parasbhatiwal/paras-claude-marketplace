---
name: setup-workflow
description: Use this skill the first time the v2 workflow runs in a repo, or when work or route reports a missing precondition. Verifies gh auth and the GitHub remote, creates the workflow labels, checks branch protection on the default branch, and seeds GLOSSARY.md, docs/adr and .out-of-scope as needed.
---

# Setup workflow

One-time (idempotent) preparation so `work`, `deliver` and `triage` never fail
halfway on a missing precondition. Report each item as ✓ done, ✓ already
there, or ✗ needs the human — and change nothing the human has configured
differently.

1. **Tooling.** `gh auth status`; a GitHub remote; `gh` version (sub-issues
   need 2.94+, else the documented API fallback is used). No remote → get the
   repo URL from the human and wire it up (`git init` if needed,
   `git remote add origin <url>`). Done when `gh repo view` prints the project
   from inside this directory; if it can't, stop and say what is missing.
2. **Labels.** Create any missing from `../../references/workflow-labels.md`
   (`gh label create`): categories, the six states, `agent-working`, `epic`,
   `wayfinder:map` and `wayfinder:<type>`.
3. **Default branch protection.** Check required reviews and no direct pushes
   (`gh api repos/{owner}/{repo}/branches/<default>/protection`). Absent →
   warn clearly: for autonomous runs, protection is the real wall and the
   session hook is only a second one. Offer the exact settings; the human
   applies them.
4. **Project files, lazily.** `CLAUDE.md` via `project-context`. Create
   `GLOSSARY.md`, `docs/adr/` and `.out-of-scope/` only when first needed, not
   now. If a legacy `CONTEXT.md` / `CONTEXT-MAP.md` exists, offer to `git mv`
   it to its `GLOSSARY` name and update references to the old name.
5. **Cloud readiness** (if they intend cloud runs): walk
   `../../references/autonomous-mode.md` — `TEAM_AUTONOMOUS=1`, git identity,
   `gh` credentials, installable toolchain. Anything only a human can do goes
   through `wizard`.
6. **Test runner.** Detect via `run-tests`; if none, point at
   `../../references/testing-bootstrap.md` — `implement` refuses to run
   without one, and an autonomous run would stall on it.

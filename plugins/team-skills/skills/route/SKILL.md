---
name: route
description: Use this skill as the front door when the request is open-ended or it is unclear which workflow applies - "what should I do", "where are we", "help me with this", "I have an idea", a bare issue number, a vague bug, a pile of issues, a stuck branch. Inspects the repo and the request, picks the right skill or flow, says why in one line, and runs it.
---

# Route

You do not need to remember every skill. This skill reads the situation,
chooses, and **starts the chosen flow** — it does not just advise. Where the
choice is a real fork (two flows fit and the difference matters), ask once,
with a recommendation, then go.

Before recommending that a skill be skipped, or describing what it does, read
its `SKILL.md`: the table below is for orientation only.

## Step 1 — Read the situation (cheap, in this order)

1. **The request.** Issue number / URL, pasted ticket, a sentence, or nothing.
2. **The repo.** `git status`, current branch, `git log -5`, open PRs for the
   branch (`gh pr list --head <branch>`), whether `CLAUDE.md` exists and is
   fresh, whether `GLOSSARY.md` / `docs/adr/` exist.
3. **The issue, if there is one.** Labels tell you the state:
   `workflow-labels.md` (`../../references/workflow-labels.md`). An issue
   already `ready-for-agent` needs `deliver`, not another grill.
4. **The tree.** Uncommitted diff? Red tests? A half-finished feature branch
   with `--t` subtask branches (an interrupted `deliver`)?

## Step 2 — Pick

| Situation | Run |
|---|---|
| A feature, bug or requirement to be built; or an issue number to work | `work` |
| Issue already `ready-for-agent` with a brief, and the user wants it built now | `deliver` |
| Issues piling up that **you didn't write** (bug reports, requests) | `triage` |
| Something broken, throwing, flaky, slow — no clear cause | `diagnose` |
| Idea too big or foggy for one session (greenfield, huge feature) | `wayfinder` |
| A design question that needs a runnable answer (state model, UI) | `prototype` |
| A fact outside the repo is needed (API behavior, library, spec) | `research` |
| Need an answer only someone else holds | `to-questionnaire` |
| Only a human can do the step (credentials, dashboards, cutover) | `wizard` |
| Messy diff or branch to review | `review-changes` |
| Uncommitted, green work to land | `commit-changes` → `push-branch` → `open-pr` |
| Codebase feels hard to change or test; spare time | `improve-architecture` |
| Fuzzy or overloaded terms; a decision worth recording | `domain-modeling`, `adr` |
| Risky design: auth, payments, PII, files, tenancy, public API | `threat-model` |
| Existing project below standard; nothing enforced | `principles-audit`, `project-rules` |
| UI feels dated or inconsistent | `ux-audit` |
| New repo | `bootstrap-project` |
| Dependencies / CVEs | `dependency-upgrade` |
| Cutting a version | `release` |
| `CLAUDE.md` missing or stale | `project-context` |
| A build just ended, especially a rough one | `retro` |
| Context is bloated and the work continues elsewhere | `handoff` |
| The user did not follow your last message | `wait-what` |
| First use in this repo | `setup-workflow` |
| Writing a skill, `CLAUDE.md` or other agent-facing doc | `writing-for-agents` |

## Step 3 — Resolve conflicts

- **Small but real work** still goes through `work`. A task that "looks
  small" is exactly where a hidden assumption comes back wrong from the
  cloud. The only exemption: the user is present for the whole thing and says
  so — then `feature-ticket` / `bug-ticket`, the attended path.
- **Bug**: hard or unclear cause → `diagnose` first; the result feeds `work`.
  A clear, small bug → `work` (its grill runs `diagnose` anyway).
- **Interrupted `deliver`** (integration branch exists with open subtask PRs
  or `agent-working` labels): do not start over. Report the state and offer
  to resume `deliver` on the same integration branch.
- **Several fit**: choose the earliest in the pipeline. Thinking before
  building; never skip a stage because a later one also fits.
- **Nothing fits**: say so, and do the task normally. Do not force a flow.

## Step 4 — Announce and run

One line: `→ <skill>: <why this, not the nearest alternative>`. Then invoke
it with the user's original words as its input. If the user redirects, follow
them — routing is a default, not a rule.

## Context hygiene (when a flow is long)

Keep the grill → spec → tickets chain in **one unbroken context**; do not
compact or clear until the tickets are published. Each ticket's implementer
starts fresh from its brief — that is why briefs are written to stand alone.
At any other phase boundary, in order: continue; `/clear` if nothing carries;
`handoff` if the work moves to a new harness, directory or person; a
subagent for a tightly scoped side task; `/compact` last, not first.

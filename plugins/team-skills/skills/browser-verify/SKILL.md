---
name: browser-verify
description: Use this skill when the user asks to manually test or verify something in a real browser with Claude in Chrome - "test this in the browser", "try the feature in Chrome", "verify issue 42 / this PR / this branch works", "click through it". Turns a ticket, issue, task description, branch or PR into a test plan, runs the app, drives Chrome through it, and reports pass or fail with evidence.
---

# Browser verify

Manual testing, done by Claude in a real Chrome. The user asks for it by
pointing at the work: an **issue / ticket**, a **PR**, a **branch**, or a
plain **task description**. Nothing in the delivery flow calls this
automatically — it runs when asked.

It verifies behavior a person would see. It does not replace the test suite
and never reports a pass it did not observe.

## Step 1 — Resolve what to test

| The user gave | Do |
|---|---|
| Issue / ticket (`#42`, URL) | `gh issue view`: the agent brief's acceptance criteria, else the spec's user stories. Find its PR or branch (`gh pr list --search`, `Closes #n` in commits). |
| PR (`#57`, URL) | `gh pr view`: the *Human verification* section, *Delivered*, and the branch. |
| Branch name | Read its commits and linked issue/PR the same way. |
| A description | Test exactly that, on the current checkout. |

Take the plan from, in order of trust: the PR's browser test steps or Human
verification list → the brief's acceptance criteria → the spec's user
stories. Keep only what is observable in a browser; list anything that is not
(batch jobs, API-only behavior) as **not covered**, with the reason.

**Gate: is there a web UI?** Grep for a frontend framework, templates, or a
served page. None (a CLI, library, API-only service) → say so and stop; do
not invent screens. An API-only change can be exercised through its UI only if
one exists.

## Step 2 — Write the plan and confirm it

A numbered list; each step is **Do** → **Expect**, with the criterion it
covers. Include the unhappy paths the criteria imply (empty input, error
state, permission denied), not just the happy path. Show it and wait for the
user's yes or edits — they may add a flow or drop one.

## Step 3 — Get the right code running

- **Current branch is the target:** use it.
- **Different branch or a PR:** never disturb the user's working tree. Use
  `git worktree add` into a temp directory on that branch (or `gh pr checkout`
  inside one), and install dependencies there. Say which branch you are
  testing so results are attributable.
- **Start the app** with the command from `CLAUDE.md` (or the built-in `run`
  skill); wait until the URL answers. Note the port.
- Use **local** URLs. Anything else (staging, production) only if the user
  names it, and then without destructive actions.
- Needs a login or seed data? Use test accounts and fixtures from the repo's
  docs. If there are none, ask. Never use real credentials, and never type a
  secret you were not given for this.

## Step 4 — Drive Chrome

1. Load the Chrome tools in one call (they are deferred): use the
   claude-in-chrome skill if it is installed, or `ToolSearch` for
   `mcp__claude-in-chrome__*`. If they are unavailable, say so, hand over the
   plan as a manual checklist, and stop — do not simulate a result.
2. `tabs_context_mcp` first; then work in a **new tab** (`tabs_create_mcp`).
   Never reuse a tab id from an earlier session.
3. Record: start a GIF named for the work (`verify-issue-42.gif`), capture a
   frame before and after each action.
4. Walk the plan. For each step: act, then **look** (screenshot or page text)
   and compare with **Expect**. Also read the console
   (`read_console_messages`, filter with a `pattern` such as `error|warn`) and
   failed requests (`read_network_requests`) — a UI that looks right while the
   console errors is not a pass.
5. Do not trigger browser dialogs (`alert`/`confirm`/`prompt`) — they freeze
   the connection. Avoid buttons that raise one; if one is the thing under
   test, warn the user first.
6. Stop and ask after 2–3 failed attempts at the same action, a page that
   will not load, or unresponsive elements. Do not loop.
7. Anything destructive or irreversible (delete, send, charge) happens only
   against test data and only if the plan says so.

## Step 5 — Report

```
Verified: <issue / PR / branch>  @ <commit sha>   App: <url>   Date: <date>

| # | Step | Expected | Result | Evidence |
|---|------|----------|--------|----------|
| 1 | ... | ... | PASS / FAIL / BLOCKED | screenshot note, console line |

Console / network: <clean | errors listed>
Not covered: <what a browser cannot show, and why>
Recording: <path to the GIF>
Verdict: PASS / FAIL / PARTIAL
```

`BLOCKED` is for a step that could not run (missing data, environment); say
why. Never round a FAIL or BLOCKED up to a pass.

## Step 6 — After

- **Failures:** offer, do not assume: fix now (run `diagnose` for a bug, then
  `implement`, on the branch under test), or file an issue per failure with
  the step, expected vs actual, and the evidence.
- **Share:** offer to post the report as a comment on the PR or issue. It is
  public-facing text, so ask first.
- **Clean up:** stop the dev server you started, close the tab, remove the
  worktree you created. Leave the user's working tree as you found it.

## Rules

- Only report what you observed. A step you could not do is BLOCKED, not
  passed.
- Test what was asked — do not wander the app looking for unrelated bugs; note
  an unrelated defect you happened to see in one line and move on.
- Secrets never appear in the report, the recording, or a comment: skip or
  blur frames that show them.

---
name: handoff
description: Use this skill when work must continue in a new harness, a new directory, with a colleague, or as a forked side task mid-phase - writes a portable markdown summary of the current conversation so a fresh agent can pick up. Not a default phase-boundary move; compact or clear first.
---

# Handoff

Adapted from Matt Pocock's `handoff` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

Write a handoff document summarizing the conversation so a fresh agent can
continue. Save it to the OS temp directory (`$TMPDIR`, else `/tmp`), **not**
the workspace.

- Include a **suggested skills** section naming which skills the next agent
  should invoke.
- Do **not** duplicate content held in other artifacts (specs, plans, ADRs,
  issues, commits, diffs): reference them by path or URL.
- **Redact** secrets and personal data.
- If the user passed arguments, treat them as what the next session will
  focus on and tailor the document to it.

Use it for: a new harness, a new directory (e.g. a prototype), a colleague, or
forking a side task mid-phase. Otherwise prefer continuing, `/clear`, or a
subagent first; `/compact` is the default at a real boundary.

---
name: intake
description: Use this skill to turn whatever the user handed over into exactly one GitHub issue ready for grilling - fetches an existing issue or PR, or creates a normal issue from a plain requirement - and applies the category and needs-triage labels. First stage of the work workflow.
---

# Intake

Goal: one GitHub issue, correctly labelled, that `grill` can start from. This
skill asks the human nothing about the design — that is the grill's job. It
only ensures the work *has a home*.

## Process

1. **Classify the input.**
   - Issue number / URL → fetch it fully (body, comments, labels, linked
     PRs). Parse prior triage notes so resolved questions are not re-asked.
   - Plain requirement (text, pasted ticket from elsewhere) → create the issue
     (step 3).
   - Ambiguous bare `#42` → `gh pr view 42` first, fall back to the issue.

2. **Check for duplicates and prior art.** `gh issue list --search` on the key
   nouns; read `.out-of-scope/` and `docs/adr/` if present. Already
   implemented, a duplicate, or previously rejected → tell the human, link it,
   and stop; do not create a second issue.

3. **Create the issue** (plain requirement only): a short title; a body that
   restates the requirement in the human's own words plus any context they
   gave, nothing invented. Start the body with the AI-generated disclaimer.
   `gh issue create --label needs-triage --label <category> ...`.

4. **Label.** Exactly one category (`bug` or `enhancement`) and
   `needs-triage`. An existing issue that already has a state label other than
   `needs-triage` and `needs-info` is left alone — report its state and ask
   what to do.

5. **Bugs: capture the report, not the diagnosis.** Reproduction happens in
   `grill` via `diagnose`; here, only record what the reporter said.

## Output

The issue number, its category, and a one-line statement of what was captured.
Hand off to `grill`.

## Rules

- Never invent requirements to fill a thin issue. Thin is fine; the grill
  exists for it.
- One input = one issue. Splitting into sub-issues is `spec-and-tickets`.

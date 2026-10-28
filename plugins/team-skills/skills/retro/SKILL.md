---
name: retro
description: Use this skill after a build, a bug fix, or any session that went sideways, to look back and suggest improvements to the agent's environment - navigation pointers, automated checks, coding standards, steering files, tooling - rather than to the code. Mechanical mistakes become deterministic checks; judgment calls become standards.
---

# Retro

Adapted from Matt Pocock's `retro` skill (MIT; see `THIRD_PARTY_NOTICES.md`).

A retrospective suggests improvements to the coding agent's **environment** so
future runs go better. Read `writing-for-agents` first for the writing bar.

## Steps

1. Read the primary sources for the session the user names (default: this
   one). For a past session, search the session logs on this machine. For a
   `deliver` run, also read the epic, the final PR's *Decisions the agent
   made* and *Not delivered* sections, and every `needs-info` comment — they
   are the friction the agent hit.
2. Look for candidates in these categories:
   - **Navigation** — how hard was it to find the right files? Hidden
     dependencies? A *navigation pointer* would help when the session spent a
     long time finding information.
   - **Automated checks** — mistakes a check could have caught. Read the
     repo's own check command and CI first: a check that exists but is
     unwired or broken is the finding, not a reinvention. A repo with no
     guardrail at all (no pre-commit, no CI lint/type/test) is itself a
     finding (`project-rules` builds it).
   - **Coding standards** — did the reviewer miss something? Classify the
     violation: **mechanical** (fixed syntactic pattern, banned API, import
     shape, file location) → a deterministic check (linter rule, hook, CI
     job); default to building the check over writing a rule. **Judgment
     call** (cross-file consistency, "matches the surrounding style") → a
     rule in the engineering standards.
   - **Steering files** — instructions in `CLAUDE.md` / global files that
     should move to standards or checks; oversized files.
   - **Tool economy** — expensive calls that could be streamlined.
   - **No-ops** — instructions that change no behavior.
   - **Information access** — crucial information the agent could not reach
     (dev-server logs, read-only access to a third-party service).
   - **Grill gaps** (v2 workflow) — a question the agent hit that the grill
     should have asked. The fix is a line in the `grill` checklist or the
     project's `CLAUDE.md`, not a patch to the code.
3. Present candidates in severity order.

## Reference

Work passes through **implementation** (the most context pressure: explore,
write, debug) and **review** (least: it receives a diff). So impose coding
standards in *review*, not on the implementer.

- `CLAUDE.md` is pushed into every session: use it very sparingly, mostly for
  navigation pointers.
- Standards are read during review, not implementation.
- Docs are reference files reached by pointer; look for existing docs before
  writing new ones.
- Skills carry docs whose description must trigger loading.

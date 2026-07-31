---
name: brainstorm
description: Use this skill when starting a feature, exploring a problem, or whenever an approach needs to be designed before writing code. Frames the problem, generates distinct options with tradeoffs, recommends one, and breaks the work into small TDD-able chunks.
---

# Brainstorm

Design the approach BEFORE any code is written. Never skip straight to
implementation for non-trivial work.

## Process

1. **Frame the problem.** Restate what is being asked in one or two sentences:
   the user-visible outcome, the constraints, and what is explicitly out of
   scope. If the request is ambiguous, ask the user targeted questions now —
   not after code exists.
2. **Explore the codebase first.** Look for existing utilities, patterns, and
   prior art that solve part of the problem. Never propose new code where a
   reusable implementation already exists.
3. **Generate 2–4 genuinely distinct options.** For each: a one-line summary,
   how it works, its tradeoffs (complexity, risk, testability, maintenance).
   Do not pad with straw-man options. Judge every option against the
   `engineering-principles` skill — which boundary owns this, what the
   contract and failure modes are, where the trust boundary sits, and whether
   the option fixes the cause or patches a symptom.
4. **Recommend one** and say why in plain terms. If the choice materially
   affects the user (API shape, UX, cost), confirm it with them via a question
   rather than assuming.
5. **Break the chosen approach into chunks.** Each chunk must be:
   - Small enough to implement in one red→green→refactor cycle
   - Independently testable (a chunk that cannot be expressed as a failing
     test first is scoped wrong — split or reshape it)
   - Ordered so earlier chunks never depend on later ones

## Output

End with a numbered chunk list, e.g.:

```
Approach: <one line>
Chunks:
1. <chunk> — test: <what the failing test will assert>
2. <chunk> — test: <...>
```

This chunk list is the input to the `implement` skill (one chunk per cycle).

## Rules

- If the chosen approach does not fit the current design, the first chunk is
  the refactor that makes it fit — never wedge the feature in beside the
  design (`engineering-principles`, the no-patchwork doctrine).
- Decisions that are expensive to reverse get an ADR; note that as a chunk.
- No file edits during brainstorming. This skill is read-only.
- Keep the whole output scannable — reviewers and teammates read this later
  in the PR description.

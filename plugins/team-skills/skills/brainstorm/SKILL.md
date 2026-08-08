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
   scope. If the request is ambiguous **in a way that would change what gets
   built**, ask the user targeted questions now — not after code exists, and
   never resolve it with a silent guess. Ambiguity that does not change the
   outcome (which internal helper name, which of two equivalent libraries) is
   yours to decide and move on; ambiguity that does (what happens on a
   duplicate, who is allowed to do this, what the user sees when it fails) is
   not.
2. **Explore the codebase first.** Look for existing utilities, patterns, and
   prior art that solve part of the problem. Never propose new code where a
   reusable implementation already exists.
3. **Generate 2–4 genuinely distinct options.** For each: a one-line summary,
   how it works, its tradeoffs (complexity, risk, testability, maintenance).
   Do not pad with straw-man options. Judge every option against the
   `engineering-principles` skill — which boundary owns this, what the
   contract and failure modes are, where the trust boundary sits, and whether
   the option fixes the cause or patches a symptom.
4. **Recommend one** and say why in plain terms — see "Plain language" below.
   If the choice materially affects the user (API shape, UX, cost, what
   happens in an edge case they would notice), confirm it with them via a
   question rather than assuming. Never pick silently on their behalf and
   mention it later; a decision surfaced after the fact is not a decision they
   made, it is one they are told they made.
5. **Break the chosen approach into chunks.** Each chunk must be:
   - Small enough to implement in one red→green→refactor cycle
   - Independently testable (a chunk that cannot be expressed as a failing
     test first is scoped wrong — split or reshape it)
   - Ordered so earlier chunks never depend on later ones

## Plain language

The person on the other end of a question may not write code. Do not require
them to. Every question posed to the user, and the recommendation offered
alongside it, must be answerable by someone who has never seen the codebase:

- **Translate the tradeoff into its real-world consequence, not its
  implementation.** Not "should we use optimistic or pessimistic locking on
  the fee row?" — instead: "if two clerks try to collect the same fee at the
  exact same moment, should the second one see an immediate error, or should
  the system make them wait a moment and then try automatically?" Both
  describe the same engineering decision; only one is answerable by the
  person who actually knows what should happen at that fee counter.
- **If a tradeoff cannot be phrased without jargon, it has not been understood
  well enough to ask about yet.** Go back and work out what it actually means
  for the person using the product before framing the question — a
  jargon-laden question is a sign the translation step was skipped, not a
  sign the user needs to learn the jargon.
- **The recommendation still has to be an opinion, not a menu.** "Here are
  four options" pushed onto someone with no basis to judge them is an
  abdication, not a courtesy. Recommend one, plainly, and explain the
  consequence of the alternative in the same everyday terms — then let them
  override it if they know something you don't.
- **Never let silence read as permission for a jargon-only decision.** If the
  user says "you decide" to a question that is genuinely theirs to answer
  (money, safety, who can do what to whose data), restate the plain-language
  consequence of your default choice before proceeding, so agreement is
  informed rather than assumed.

This is not a lower bar for the decision itself — see the decision order and
non-negotiables in `engineering-principles`, which apply exactly as strictly
regardless of who is driving. It is a bar on how the decision is *surfaced*.
The code this produces should read, to a reviewer who knows the codebase, as
written by a senior engineer who happened to explain their reasoning simply;
it should never read as though corners were cut because nobody who could
object was watching for jargon they'd have caught.

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
  This includes a decision nobody has explicitly made yet but is about to get
  made by default — see "Silence is a decision too" in the `adr` skill.
- No file edits during brainstorming. This skill is read-only.
- Keep the whole output scannable — reviewers and teammates read this later
  in the PR description.

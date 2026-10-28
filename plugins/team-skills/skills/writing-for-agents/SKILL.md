---
name: writing-for-agents
description: Use this skill when creating or editing a document an agent consumes - a skill, CLAUDE.md or AGENTS.md, a doc reached by a pointer. Covers context pointers, the two loads, the information hierarchy, completion criteria, leading words, and pruning.
---

# Writing for agents

Adapted from Matt Pocock's `writing-for-agents` skill (MIT; see
`THIRD_PARTY_NOTICES.md`), condensed.

The same levers make any agent-facing document predictable: the agent takes
the same *process* every run rather than producing the same output.

## Context pointers

A **context pointer** is a reference held in context that names out-of-context
material and encodes the condition for reaching it — a skill description, a
line in `CLAUDE.md` naming a doc. Its *wording*, not its target, decides when
and how reliably the agent reaches the material. A must-have target behind a
weak pointer is a variance bug: sharpen the wording first; inline only if
sharpening fails. A pointer says what the material is and lists the
**branches** that should trigger it. Front-load the leading word; one trigger
per distinct branch (synonyms are one branch twice); cut identity the body
already carries.

## The two loads

- **Context load** — always-loaded material (a `CLAUDE.md` line, a skill
  description) costs tokens and attention every turn whether or not it fires.
- **Cognitive load** — the human is the index: which documents exist and when
  to reach for each. Spend it where human judgment matters.

## Information hierarchy

Documents mix **steps** (ordered actions) and **reference** (rules, facts
consulted on demand). Ladder, most immediate first: in-file step → in-file
reference → **disclosed reference** (separate file behind a pointer, loaded
only when it fires). **Progressive disclosure** moves material down so the top
stays legible: inline what every branch needs, push behind a pointer what only
some branches reach. **Co-locate** a concept's definition, rules and caveats
under one heading. **Sprawl** — a document just too long — thins attention;
the cure is the ladder and splitting by branch or sequence.

## Steps and completion criteria

Every step ends on a **completion criterion**. *Clarity*: can the agent tell
done from not-done? A vague bound ("understanding reached") invites premature
completion — sharpen the bound first. *Demand*: "every modified model
accounted for" forces legwork that "produce a change list" does not. The
strongest criteria are checkable and exhaustive. Split a sequence only when
the visible later steps tempt the agent to rush the current one.

## Leading words

A **leading word** is a compact concept already in pretraining that the agent
thinks with (_tracer bullet_, _fog of war_, _red_, _tight_). Repeat it as a
token, never a sentence. "A loop that is fast, deterministic and low-overhead"
→ a *tight* loop; "a loop you believe in" → *red*. Hunt for restatements that
a leading word retires. Prefer the **positive**: prohibition drags the
forbidden behavior into context ("don't think of an elephant") — state the
target behavior instead; keep prohibitions for hard limits.

## Pruning

- **Single source of truth** per meaning; duplication costs tokens and
  inflates prominence.
- The **environment is a source of truth** (`package.json` scripts, configs,
  `--help`). A document restating it is a cache; cache only what the agent
  cannot find by looking: the unwritten convention, the reason behind a choice,
  the gotcha no config confesses.
- Check every line's **relevance**; stale layers settle as **sediment** because
  adding feels safe and removing risky.
- Hunt **no-ops**: instructions the model already obeys. The test is
  model-relative — settle disagreements by running the document, not debating.
  Delete the whole sentence rather than trimming words.

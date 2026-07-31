---
name: adr
description: Use this skill when a decision that is expensive to reverse is being made or has just been made ("record this decision", "write an ADR", "why did we choose X", "architecture decision"). Writes or supersedes an architecture decision record in docs/adr/ capturing the forces, the choice, the consequences, and the alternatives rejected.
---

# ADR (architecture decision record)

Decisions that are expensive to reverse — a datastore, an auth model, a
boundary, a protocol, a deliberate deviation from team standards — get a short
record written **at the time the decision is made**. ADRs are what stop a team
relitigating the same choice every six months, and they are the highest-value
context `project-context` feeds into CLAUDE.md.

## When an ADR is required

- Choosing or replacing a framework, datastore, queue, or cloud primitive
- Defining or moving a bounded-context boundary or a public contract
- Auth/authz model, tenancy model, or data-classification decisions
- Adopting a pattern with ongoing cost (event sourcing, CQRS, outbox, cache)
- A deliberate exception to `engineering-principles` or to the project's
  enforced rules (`project-rules`)
- Anything you would otherwise explain twice in a PR review

**Not** for reversible, local choices — naming, file layout inside a module,
a library swap with no API impact. An ADR log full of trivia is unread.

## Write it

1. Find the next number: list `docs/adr/`, take the highest + 1, zero-padded
   to four digits. Create the directory if this is the first one.
2. Filename: `docs/adr/NNNN-short-kebab-title.md`.
3. Fill the template. Keep it to one page — an ADR nobody reads has failed.

```markdown
# ADR-NNNN: <decision in a short noun phrase>

Date: YYYY-MM-DD
Status: proposed | accepted | superseded by ADR-NNNN | deprecated
Deciders: <who>

## Context

<The forces at play: constraints, scale, team, deadlines, what breaks today.
Written so a new joiner understands the problem without knowing the answer.
Facts and numbers, not opinions.>

## Decision

<What we are doing, in one paragraph, active voice: "We will …">

## Consequences

<What becomes easier, what becomes harder, what we now have to maintain, what
we are accepting as a risk, and what would make us revisit this.>

## Alternatives considered

- **<option>** — why it was rejected (a real reason, not a straw man)
- **<option>** — …
```

4. Link it: reference the ADR number in the PR body and in `CLAUDE.md` /
   `docs/engineering-rules.md` where the decision shows up.

## Superseding

Never edit a decided ADR to change the decision — the record of what was once
true is the point. Instead:

1. Write a new ADR that states the new decision and references the old one.
2. Set the old one's status to `superseded by ADR-NNNN` (that edit is the only
   one allowed) and leave everything else untouched.

## Rules

- Written when the decision is made, not reconstructed months later. A
  retrospective ADR is a guess about your own reasoning.
- **Status is honest.** `proposed` until the team agrees; do not mark
  `accepted` on the author's own say-so if others must live with it.
- Record the alternatives *seriously*. The rejected options are what a future
  reader needs most — they are the ones they will otherwise re-propose.
- Say what would make you revisit. A decision with no stated trigger for
  reconsideration becomes permanent by accident.
- No secrets, no customer names, no vendor pricing under NDA.
- If the decision deviates from `engineering-principles`, say so explicitly and
  name which rule — an undeclared deviation is how standards quietly die.

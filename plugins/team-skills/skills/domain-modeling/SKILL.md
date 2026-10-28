---
name: domain-modeling
description: Use this skill when discussing codebase terminology, writing or editing a GLOSSARY.md, resolving an overloaded or fuzzy term, or deciding whether a decision deserves an ADR. The active discipline of sharpening a project's domain language and writing it down the moment it crystallizes.
---

# Domain modeling

Adapted from Matt Pocock's `domain-modeling` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

The *active* discipline: challenge terms, invent edge-case scenarios, write
the glossary and decisions down as they crystallize. (Merely *reading*
`GLOSSARY.md` for vocabulary is a one-line habit any skill has — this skill is
for when you are changing the model.)

## File structure

Most repos: one `GLOSSARY.md` at the root and `docs/adr/`. If a
`GLOSSARY-MAP.md` exists at the root, the repo has several contexts; it points
to each context's `GLOSSARY.md` and `docs/adr/`, and lists their
relationships. Create files **lazily** — only when there is something to
write. Infer the relevant context from the topic; ask if unclear.

## During the session

- **Challenge against the glossary.** A term conflicting with `GLOSSARY.md`:
  call it out immediately.
- **Sharpen fuzzy language.** Propose the precise canonical term ("account":
  the Customer or the User?).
- **Discuss concrete scenarios** that probe edge cases and force precision at
  the boundaries between concepts.
- **Cross-reference with code.** When the user says how something works,
  check the code; surface contradictions ("your code cancels whole Orders,
  but you said partial cancellation exists").
- **Update `GLOSSARY.md` inline**, when each term resolves — don't batch.
- **Offer ADRs sparingly** — use the `adr` skill, and only when all three
  hold: **hard to reverse**, **surprising without context**, and the result
  of a **real trade-off**. If any is missing, skip it.

## GLOSSARY.md format

```markdown
# <Context name>
<One or two sentences: what this context is and why it exists.>

## Language

**Order**:
A request from a customer to buy goods.
_Avoid_: Purchase, transaction

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

Rules: **be opinionated** (pick the best word, list the rest under
`_Avoid_`); definitions are one or two sentences, saying what it **is**, not
what it does; only terms **specific to this context** — general programming
concepts (timeouts, error types) never belong; group under subheadings when
clusters emerge. A glossary is not a spec, a scratch pad, or a home for
implementation decisions — totally devoid of implementation detail.

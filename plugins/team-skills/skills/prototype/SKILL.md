---
name: prototype
description: Use this skill to answer a design question with throwaway code - "does this state model feel right?" (a logic demo anyone can click through) or "what should this look like?" (several radically different UI variants on one route). Built to be thrown away; the validated decision folds into real code.
---

# Prototype

Adapted from Matt Pocock's `prototype` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

A prototype is **throwaway code that answers a question**. The question
decides the shape.

## Pick a branch

- **"Does this logic / state model feel right?"** → `prototype-logic.md` (next
  to this file): one shareable HTML file a non-developer can drive.
- **"What should this look like?"** → `prototype-ui.md`: several radically
  different variants on one route behind `?variant=`.

Wrong branch wastes the whole prototype. If ambiguous and nobody is reachable
(e.g. inside a `grill` in the cloud — don't: prototypes are for the attended
grill), default by the surrounding code (backend module → logic; page or
component → UI) and state the assumption at the top.

## Rules for both

1. **Throwaway and marked.** Put it near where it will be used, named so a
   casual reader sees it is a prototype. UI routes follow the project's
   routing convention.
2. **Trivial to run.** One command in the task runner, or a double-click HTML
   file.
3. **No persistence** unless persistence is what is being checked (then a
   scratch DB or file named "PROTOTYPE, wipe me").
4. **Skip the polish.** No tests, no error handling beyond runnable, no
   abstractions.
5. **Surface the state** after every action / variant switch.
6. **Capture it when done.** Fold the validated decision into the real code;
   keep the prototype itself as a **primary source** on a `prototype/<name>`
   branch out of main with a pointer on the implementation issue; record the
   verdict and the question it settled. Main keeps only the decision.
   A snippet that encodes a decision more precisely than prose (reducer,
   state machine, schema) may be inlined in the spec.

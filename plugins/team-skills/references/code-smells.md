# Smell baseline

Adapted from Matt Pocock's `code-review` skill (MIT; see
`THIRD_PARTY_NOTICES.md`), after Fowler's *Refactoring*, ch. 3.

The Standards axis of `review-changes` always carries this baseline, even when
the repo documents nothing. Two rules bind it: **the repo overrides** (a
documented standard that endorses something below suppresses that smell), and
**always a judgment call** (label findings "possible Feature Envy", never a
hard violation; skip what tooling already enforces). Each reads *what it is* →
*how to fix*:

- **Mysterious Name** — a name that doesn't reveal what it does or holds. →
  Rename; if no honest name comes, the design is murky.
- **Duplicated Code** — the same logic shape in more than one hunk or file. →
  Extract the shared shape.
- **Feature Envy** — a method reaching into another object's data more than
  its own. → Move it onto the data it envies.
- **Data Clumps** — the same few fields or params travel together. → Bundle
  them into one type.
- **Primitive Obsession** — a primitive or string standing in for a domain
  concept. → Give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if` cascade on the same type
  recurs. → Polymorphism, or one shared map.
- **Shotgun Surgery** — one logical change forces scattered edits across many
  files. → Gather what changes together into one module.
- **Divergent Change** — one file edited for several unrelated reasons. →
  Split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters or hooks for needs the
  spec doesn't have. → Delete; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation callers shouldn't know.
  → Hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly delegates onward. → Cut it;
  call the target directly.
- **Refused Bequest** — a subclass that ignores or overrides most of what it
  inherits. → Composition instead of inheritance.

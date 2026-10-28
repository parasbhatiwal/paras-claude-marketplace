---
name: codebase-design
description: Use this skill for the shared vocabulary and principles of deep-module design - module, interface, depth, seam, adapter, leverage, locality - when designing or restructuring a module's shape, deciding where a seam goes, making code more testable or navigable by agents, or when another skill needs these terms.
---

# Codebase design

Adapted from Matt Pocock's `codebase-design` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

Design **deep modules**: a lot of behavior behind a small interface, placed at
a clean seam, testable through that interface. Use these terms exactly —
don't substitute "component", "service", "API" or "boundary".

## Glossary

- **Module** — anything with an interface and an implementation; scale
  agnostic (function, class, package, slice).
- **Interface** — everything a caller must know to use it correctly: types,
  invariants, ordering, error modes, config, performance characteristics.
  Not just the signature.
- **Implementation** — what is inside. Distinct from **Adapter**.
- **Depth** — leverage at the interface: behavior exercisable per unit of
  interface learned. **Deep** = lots behind a small interface; **shallow** =
  interface nearly as complex as the implementation.
- **Seam** *(Feathers)* — a place you can alter behavior without editing
  there; the *location* of a module's interface. Where to put it is its own
  decision. (Not "boundary": that is DDD's bounded context.)
- **Adapter** — a concrete thing satisfying an interface at a seam; a *role*.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get: change, bugs, knowledge and
  verification concentrate in one place.

## Principles

- Depth is a property of the **interface**, not the implementation; a deep
  module may be internally many small swappable parts, with internal seams
  private to it.
- **Deletion test**: imagine deleting the module. Complexity vanishes → it
  was a pass-through. Complexity reappears across N callers → it earned its
  keep.
- **The interface is the test surface.** Callers and tests cross the same
  seam. Wanting to test *past* it means the module is the wrong shape.
- **One adapter = a hypothetical seam; two = a real one.** No seam unless
  something varies across it.

## Designing for testability

1. Accept dependencies; don't create them.
2. Return results; don't produce side effects.
3. Small surface area — fewer methods, fewer params, fewer tests.

## Deepening a cluster, by dependency category

1. **In-process** (pure, in-memory): merge and test through the new interface;
   no adapter.
2. **Local-substitutable** (a local stand-in exists, e.g. in-memory
   filesystem, embedded DB): test with the stand-in; the seam is internal.
3. **Remote but owned** (your own network services): a **port** at the seam;
   production HTTP/gRPC/queue adapter + in-memory adapter for tests.
4. **True external** (third parties): inject as a port; tests use a mock
   adapter.

Testing strategy: **replace, don't layer.** Old unit tests on the shallow
modules become waste once tests exist at the deepened interface — delete them.
Tests assert observable outcomes through the interface and survive internal
refactors; a test that changes when the implementation changes is testing past
the interface.

## Design it twice

When exploring alternative interfaces for a chosen candidate (your first idea
is unlikely to be the best): frame the constraints, dependencies (by category
above) and a rough sketch for the user; then spawn 3+ subagents in parallel,
each designing a **radically different** interface under a different
constraint — (1) minimize: 1–3 entry points, max leverage each; (2) maximize
flexibility and extension; (3) optimize the most common caller so the default
case is trivial; (4) ports & adapters for cross-seam dependencies. Brief each
with the file/coupling details, this vocabulary and `GLOSSARY.md`. Each
returns the interface (with invariants, ordering, error modes), a usage
example, what hides behind the seam, the adapter strategy, and trade-offs.
Present sequentially, compare in prose by depth, locality and seam placement,
then **recommend** — be opinionated; propose a hybrid if parts combine.

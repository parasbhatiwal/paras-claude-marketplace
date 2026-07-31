# Design: structure, SOLID, DRY, boundaries, errors

## Dependency rule (the one that matters most)

Source dependencies point **inward**, toward policy, never outward toward
detail.

```
   inbound adapters ──┐                     ┌── outbound adapters
   (http, cli, jobs,  │                     │   (db, http clients, queues,
    ui, webhooks)     ▼                     ▼    filesystem, email)
                  ┌────────────────────────────┐
                  │        application         │  use cases / orchestration
                  │  ┌──────────────────────┐  │
                  │  │        domain        │  │  entities, rules, invariants
                  │  └──────────────────────┘  │
                  └────────────────────────────┘
```

- **Domain**: pure. No framework, no ORM, no HTTP, no clock, no randomness, no
  I/O. Testable without a single mock.
- **Application**: orchestrates domain objects, defines *ports* (interfaces)
  it needs. Depends on domain only.
- **Adapters**: implement ports, translate wire/DB shapes to domain types.
  Everything framework-specific lives here and nowhere else.

Practical tests of the rule:
- Could you swap Postgres for another store by writing one adapter? If a
  repository type leaks `Row`, `Model`, or SQL into the application layer, no.
- Could you run the domain test suite with no containers, no network, no
  fixtures directory? If not, the boundary is leaking.
- Does an import in `domain/` mention `express`, `next`, `prisma`, `django`,
  `axios`? That is a violation, not a shortcut.

Enforce it mechanically where possible (`eslint-plugin-boundaries`,
`import-linter`, `depguard`, `go list` rules, ArchUnit). A rule a linter
enforces is a rule; a rule in a wiki is a wish.

## SOLID, concretely

- **S — Single responsibility.** A module has one reason to change. The test:
  can you describe what it does without "and"? A `UserService` that hashes
  passwords, sends email, and writes audit rows has three reasons to change.
- **O — Open/closed.** Extend by adding, not by editing a growing `switch`.
  When a third case forces you to touch the same conditional again, that
  conditional wants to be polymorphism or a registry/strategy map. Two cases:
  leave the `if` alone (YAGNI).
- **L — Liskov substitution.** An implementation must honor the contract's
  promises: no narrowing accepted input, no widening thrown errors, no
  "unsupported operation" stubs. A subtype that throws where the base returns
  is a broken hierarchy — prefer composition.
- **I — Interface segregation.** Ports are defined by the **consumer's** need,
  not the provider's capability. A use case that only reads gets a
  `FindUserById` port, not a 30-method `UserRepository`. Small ports make test
  doubles trivial and honest.
- **D — Dependency inversion.** High-level policy depends on abstractions the
  high level owns; adapters implement them. Concretely: the interface file
  lives next to the *use case*, not next to the database code.

## DRY, and where it turns harmful

DRY is about **knowledge**, not characters. Two identical fragments that
change for different reasons are not duplication — they are coincidence.

- Deduplicate a rule that exists in two places (a tax calculation, a
  validation constraint, an error message users depend on).
- Do **not** deduplicate structural similarity across bounded contexts. A
  shared `BaseEntity` or a `utils/` grab-bag that couples unrelated features
  is worse than the duplication it removed.
- Prefer the **rule of three**: duplicate once, extract on the third
  occurrence, when the shape of the abstraction is actually visible. A wrong
  abstraction costs more than duplication (it is harder to unpick).
- Before writing anything new, search for prior art. Reinventing an existing
  helper is the most common DRY violation in practice — and the cheapest to
  avoid.

## Coupling and cohesion

- Package by **feature/bounded context**, not by technical layer at the top
  level: `billing/`, `identity/`, `catalog/` — each containing its own
  domain/application/adapters. `controllers/`, `services/`, `models/` at the
  root is how everything ends up depending on everything.
- Cross-context calls go through an explicit published interface or an event —
  never by reaching into another context's internals or database tables.
- Keep the fan-out of a module small. If a file imports from eight other
  features, it is doing coordination that belongs in one place.
- Prefer composition over inheritance. Inheritance is for genuine
  substitutability (see L), not for code reuse.

## Functions, types, and state

- A function does one thing at one level of abstraction. Mixed altitudes
  (business rule + string formatting + SQL) is the most common readability
  defect.
- Make illegal states unrepresentable: use sum types/enums/discriminated
  unions and value objects (`Email`, `Money`, `UserId`) rather than primitive
  `string`/`number` everywhere. Parse, don't validate — return the narrow type.
- Default to immutability. Mutating a parameter is a side effect the caller
  cannot see.
- Keep the core pure and push side effects to the edges (functional core,
  imperative shell). Pure cores need no mocks.
- No hidden global state, no singletons holding mutable data, no module-level
  caches without an eviction story and a test.
- Inject the clock, randomness, and IDs. `new Date()` inside domain logic
  makes behavior untestable and flaky.

## Errors

Define a **taxonomy** per context, not ad-hoc strings:

- `ValidationError` — caller sent something wrong (→ 400). Never logged as an
  error; it is normal traffic.
- `NotFound`, `Conflict`, `PermissionDenied` — expected domain outcomes.
- `DependencyFailure` — a downstream broke (→ retry/circuit-break, log at
  warn/error with correlation id).
- `Bug` / unexpected — never shown to users, always logged with full context,
  always alertable.

Rules:
- Errors carry structured context (ids, operation), never secrets or PII.
- Catch only what you can handle; otherwise let it propagate with context
  added. `catch (e) { log(e) }` and continue is data corruption waiting to
  happen.
- Return typed results (`Result`/`Either`) for expected failures; reserve
  exceptions for the exceptional. Whichever the project picks, apply it
  consistently — mixing both in one layer is worse than either.
- The user-facing message and the diagnostic detail are two different things.

## Comments and documentation

- Comments explain **why**, never what. A comment restating the code is
  maintenance debt.
- Public functions get a one-line contract when the name cannot carry it:
  preconditions, failure modes, side effects.
- Match the file's existing comment density. A codebase with no comments does
  not want a sudden essay.

## ADRs — recording decisions

Any decision that is expensive to reverse gets a short ADR in `docs/adr/`:

```markdown
# ADR-0007: Use outbox pattern for order events

Date: 2026-07-31   Status: accepted   Supersedes: —

## Context
<the forces: constraints, scale, team, what breaks today>

## Decision
<what we chose, in one paragraph>

## Consequences
<what gets easier, what gets harder, what we now must maintain>

## Alternatives considered
<option — why rejected>
```

Write it when the decision is made, not retrospectively. ADRs are the memory
that stops the team relitigating a choice every six months — and the context
`project-context` feeds into CLAUDE.md.

## Smells that should stop a review

- A function longer than a screen with more than two nesting levels
- A `switch`/`if-else` chain on a type tag repeated in more than one file
- A parameter that only exists to select behavior (`doThing(x, true)`)
- A class whose name ends in `Manager`, `Helper`, `Util`, or `Data`
- A module that changes in every unrelated PR
- Business rules inside a controller, template, or migration
- Any file over ~400 lines without a structural reason

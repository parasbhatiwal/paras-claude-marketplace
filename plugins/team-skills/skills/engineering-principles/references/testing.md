# Testing strategy

`implement` owns the red→green→refactor mechanics. This file owns *what* to
test, at which level, and what "good" looks like.

## Shape of the suite

- **Unit (most)** — the domain and application layers, no I/O, milliseconds.
  If a unit test needs three mocks, the design is wrong, not the test.
- **Integration (some)** — adapters against the real thing: a real database in
  a container, a real HTTP server, real migrations. Repository/SQL correctness
  cannot be established with a mocked driver.
- **Contract (some)** — one per external boundary you own or consume, so
  provider and consumer cannot drift apart silently.
- **End-to-end (few)** — a handful of critical user journeys (signup, checkout,
  the money path). They are slow and flaky-prone; spend them where failure is
  unacceptable.

Inverted pyramids (mostly E2E) produce slow, flaky suites that teams learn to
ignore — which is the same as having no tests.

**When the real consumer does not exist yet** — a backend built before its UI,
a service before its caller — commit a **runnable scenario script** that walks
the whole path against a real instance: provision, authenticate, do the day's
work, read the result back. Not a test; a thing a human runs and watches.

Every serious defect in a young service tends to be found by running it rather
than by testing it, and the walk gets repeated by hand a dozen times anyway.
Committing it makes each repetition free, makes the sequence reviewable, and
gives the eventual UI a specification of what the flow actually is. Without it,
"nobody has used this yet" quietly becomes "nobody can."

## What to test

- Behavior visible at the module's boundary: inputs → outputs and side
  effects. Never private methods, never internal call sequences.
- The edges, always: empty, one, many; zero/negative/max; null/undefined;
  duplicate; out-of-order; concurrent; timezone and DST boundaries; unicode
  and very long strings.
- Every error path and every guard clause — an untested `throw` is an untested
  branch of the contract.
- Every security control: an authorization test asserting the *denied* case is
  as important as the allowed one. For each new endpoint, test: anonymous,
  wrong tenant, wrong role, and the resource owner.
- Every bug gets a regression test that failed before the fix (`diagnose`).

## What not to do

- Never mock the unit under test, and never mock what you do not own — wrap a
  third-party client in your own port and fake that instead; otherwise your
  mock encodes assumptions the vendor never promised.
- Mock only true externals: network, clock, randomness, filesystem, payment
  providers. Prefer fakes (a real in-memory implementation of your port) over
  mocks with expectations — fakes survive refactors; mocks assert mechanics.
- Do not assert on log output, snapshot entire DOM trees, or match error
  strings. Assert on structured, meaningful outcomes.
- Do not weaken, skip, or delete a failing test to ship. If a test is wrong,
  fix it deliberately and say so out loud.
- No conditional logic in tests (`if`/loops deciding assertions) — split into
  separate cases or a table-driven test.
- **Never set up state the application itself could not produce.** Bypassing a
  constraint, casting past a type, or writing a row the domain would reject
  makes the test prove something about a world that does not exist — and hides
  the fact that the real path cannot reach that state at all. If the setup is
  impossible through the application, that is the finding.
- Never write a test whose only purpose is to reach a line. If a branch is
  genuinely unreachable, delete it or record the exception; covering it with a
  type-violating input is coverage theatre and asserts nothing.

## Test quality

- One reason to fail per test; the name states the behavior
  ("rejects a refund larger than the original charge"), not the method.
- Arrange–Act–Assert, visible in the layout.
- Deterministic: fixed clock, seeded randomness, no sleeps (poll with a
  timeout), no shared mutable state, no ordering dependence, isolated data per
  test. A flaky test is treated as a failing test — quarantine costs trust.
- **Isolate database tests by construction, not by tidying up.** Wrap each test
  in a transaction that is rolled back, or give it its own schema/database.
  Cleanup in a teardown hook is the common alternative and it rots: it runs
  after the assertions, it is usually wrapped in a catch that hides its own
  failure, and when it silently stops working the symptom is a *later* test
  failing for reasons that look like a product bug. If a suite shares one
  database, unique constraints and other global invariants become couplings
  between tests that nobody declared.
- Build data with factories/builders that state only what the test cares
  about; sprawling fixture files hide what a test actually depends on.
- Tests are production code: same review bar, same naming, no duplication of
  setup logic — but favor explicitness over cleverness inside a test body.

## Coverage and its limits

- Diff coverage ≥ 90% on changed lines, plus a total-coverage ratchet, is the
  team gate (CI enforces both). Coverage proves what *ran*, never what was
  *verified* — it is a floor, not a goal.
- Watch for the ratchet inverting the relationship: once the number is the
  target, the cheapest way to hit it is a test that exercises a line and
  asserts nothing worth asserting. A 100% ratchet makes that pressure constant.
  When a line is hard to cover honestly, the answer is usually to delete the
  line — a defensive branch that no caller can reach is dead code wearing a
  safety costume, not a testing problem.
- Use mutation testing (Stryker/mutmut/PIT) on the highest-value modules
  (money, auth, permissions) to find assertions that never actually assert.
- Track and delete tests that never fail for any real bug; they cost time and
  buy nothing.

## Beyond correctness

- **Performance**: a test asserting query counts on hot paths, and a load
  profile for the critical journey against its budget
  (`references/quality-attributes.md`).
- **Accessibility**: automated axe checks in component/E2E tests catch the
  mechanical failures; keyboard-only and screen-reader passes are manual and
  belong on the PR's human-verification checklist.
- **Security**: dependency and secret scanning in CI; add an abuse-case test
  whenever a threat model identifies one.
- **Resilience**: for critical dependencies, test the timeout, the retry, and
  the degraded mode — inject failure rather than assuming the library behaves.

## Legacy code

When adding tests to untested code (see `principles-audit`):

1. Write **characterization tests** that pin current behavior — including the
   behavior you suspect is wrong — so refactoring is provably safe.
2. Refactor under green; do not change behavior in the same commit.
3. Only then fix the bug, with its own failing test first.

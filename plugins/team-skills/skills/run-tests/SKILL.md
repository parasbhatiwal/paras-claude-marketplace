---
name: run-tests
description: Use this skill to discover and run the project's test suite and coverage in any language — before committing, after implementing, when verifying a fix, or when asked "do the tests pass". Detects the toolchain rather than assuming one, and reports a clear red/green verdict with failure details.
---

# Run Tests

Discover the project's real test setup and run it. **Never assume an
ecosystem** — detect, then run.

## Discovery (in order)

This is the same resolution the git hooks and CI use, so a green here means
the same thing everywhere:

1. **`make test`** — if a `Makefile` defines that target.
2. **`just test`** — if a `justfile` defines that recipe.
3. **Ecosystem detection** — match the manifest and use its conventional
   runner: `package.json` scripts, `pytest`, `go test ./...`, `cargo test`,
   `mvn test`/`gradle test`, `dotnet test`, `bundle exec rspec`, `phpunit`,
   `mix test`, `swift test`, `dart test`. The full matrix, with coverage
   commands per ecosystem, is in `../../references/toolchains.md` (relative to
   this skill's directory).
4. **Nothing found → report that the project has no test runner** and point to
   `../../references/testing-bootstrap.md`. Do not fabricate a pass; the
   commit and push gates treat this as a block.

In a monorepo, detect per package. Run the packages the diff touches during a
cycle, and everything before committing.

## Running

- Run the FULL suite by default. Only scope to a subset while iterating inside
  a TDD cycle, and always finish with a full run.
- For coverage use the `test-coverage` task (`make test-coverage`, the
  project's coverage script, or the ecosystem's flag). Coverage must produce
  the report format the project's CI gate expects — usually Cobertura XML.
- Capture the exit code AND the output. A zero exit with "no tests found",
  "0 passed", or a collection error is a **FAIL** for gating purposes, not a
  pass — that is exactly how a broken test config hides.
- If the suite needs services (a database container, a fixture server), start
  them or report precisely what is missing. Never silently run a subset and
  call it the suite.

## Reporting

Always end with an explicit verdict block:

```
Verdict: GREEN (142 passed) | RED (3 failed, 139 passed)
Command: <exactly what was run>
Failures: <test name> — <one-line reason> (file:line)
Coverage: <total %, and diff coverage if computed>
```

- On RED: show the failing assertions verbatim (trimmed), not a paraphrase.
- Never soften a failure ("mostly passing") — the gate skills treat anything
  other than GREEN as a block.
- Report flakes as failures, and say which test flaked; a flaky suite is a
  defect, not a nuisance.

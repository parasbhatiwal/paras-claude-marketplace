---
name: run-tests
description: Use this skill to discover and run the project's test suite and coverage — before committing, after implementing, when verifying a fix, or when asked "do the tests pass". Reports a clear red/green verdict with failure details.
---

# Run Tests

Discover the project's real test setup and run it. Never assume npm — detect.

## Discovery (in order)

1. `package.json` scripts: `test`, `test:coverage`, `test:unit` → use them.
2. Config files: `vitest.config.*`, `jest.config.*`, `playwright.config.*`.
3. Other languages: `pyproject.toml`/`pytest.ini` → pytest; `go.mod` → `go
   test ./...`; `Cargo.toml` → `cargo test`; `Makefile` with a `test` target.
4. **Nothing found → report clearly that the project has no test runner** and
   point to the team's `testing/bootstrap.md` template. Do not fabricate a
   pass.

## Running

- Run the FULL suite by default. Only scope to a subset when iterating inside
  a TDD cycle, and always finish with a full run.
- For coverage, prefer the project's `test:coverage` script; otherwise the
  runner's coverage flag (e.g. `vitest run --coverage`).
- Capture exit code AND output — a zero exit with "no tests found" is a FAIL
  for gating purposes, not a pass.

## Reporting

Always end with an explicit verdict block:

```
Verdict: GREEN (142 passed) | RED (3 failed, 139 passed)
Failures: <test name> — <one-line reason> (file:line)
Coverage: <summary, if run>
```

- On RED: show the failing assertions verbatim (trimmed), not a paraphrase.
- Never soften a failure ("mostly passing") — the gate skills treat anything
  other than GREEN as a block.

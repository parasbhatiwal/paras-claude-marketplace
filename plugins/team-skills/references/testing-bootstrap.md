# Testing bootstrap (any language)

Team policy: **every project has a test runner, a real first test, and a
coverage report.** The commit and push gates block projects without one, and
"no test runner found" is a failure, never a pass.

Pick the section for the project's ecosystem. Whatever you pick must end up
satisfying the standard task interface in `toolchains.md` (alongside this
file): `test` runs the full suite, `test-coverage` additionally writes a
Cobertura XML report and a total-percentage summary for the CI gates.

## Done means

1. `test` runs and reports, exiting non-zero on failure.
2. `test-coverage` produces a Cobertura XML file (path recorded in the
   project's rules doc) and a total percentage.
3. One **real** first test passes — the most important pure function in the
   codebase, not `expect(true).toBe(true)`. It proves the whole pipeline.
4. The commands are reachable through the task interface: either `make test` /
   `just test`, or the ecosystem's conventional entry point.
5. CI runs them and the gates are green.

---

## JavaScript / TypeScript

```sh
npm i -D vitest @vitest/coverage-v8          # or jest, or node --test (no deps)
```

`vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // json-summary + cobertura are REQUIRED by the CI gates
      reporter: ["text", "json-summary", "cobertura"],
      include: ["src/**"],
    },
  },
});
```

Scripts (these names are what hooks and CI look for):

```json
{ "test": "vitest run", "test:watch": "vitest", "test:coverage": "vitest run --coverage" }
```

For UI projects add `environment: "jsdom"` plus Testing Library, and assert on
accessible roles and behavior — never snapshots of implementation detail.

## Python

```sh
uv add --dev pytest pytest-cov          # or poetry add --group dev / pip install
```

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"

[tool.coverage.run]
source = ["src"]
branch = true
```

Commands: `pytest` and
`pytest --cov --cov-report=xml --cov-report=term`
(`coverage.xml` is already Cobertura).

## Go

Nothing to install. Conventions: `foo.go` → `foo_test.go`, table-driven tests,
`t.Parallel()` where safe.

```sh
go test ./...
go test ./... -coverprofile=coverage.out -covermode=atomic
go run github.com/boumenot/gocover-cobertura < coverage.out > coverage.xml
```

## Rust

```sh
cargo install cargo-llvm-cov      # once, or use the CI action
cargo test --all-features
cargo llvm-cov --cobertura --output-path coverage.xml
```

Unit tests live in `#[cfg(test)] mod tests` beside the code; integration tests
in `tests/`.

## JVM (Java / Kotlin)

JUnit 5 + JaCoCo. Maven:

```xml
<plugin>
  <groupId>org.jacoco</groupId><artifactId>jacoco-maven-plugin</artifactId>
  <executions>
    <execution><goals><goal>prepare-agent</goal></goals></execution>
    <execution><id>report</id><phase>test</phase><goals><goal>report</goal></goals></execution>
  </executions>
</plugin>
```

`mvn -B test` / `gradle test`; convert the JaCoCo XML to Cobertura in CI if the
diff-coverage tool needs it.

## .NET

```sh
dotnet add package coverlet.collector
dotnet test
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura
```

## Ruby

```sh
bundle add rspec simplecov simplecov-cobertura --group development,test
```

`spec/spec_helper.rb`:

```ruby
require "simplecov"
require "simplecov-cobertura"
SimpleCov.start { formatter SimpleCov::Formatter::CoberturaFormatter }
```

## PHP

```sh
composer require --dev phpunit/phpunit
vendor/bin/phpunit --coverage-cobertura coverage.xml
```

## Others

- **Elixir**: `mix test`, `mix test --cover` (`excoveralls` for Cobertura)
- **Swift**: `swift test --enable-code-coverage`
- **Dart/Flutter**: `flutter test --coverage` (lcov; convert if needed)
- **C/C++**: CTest + `gcovr --cobertura coverage.xml`

---

## Conventions (all languages)

- Test files live where the ecosystem expects them (beside the code for
  JS/Go/Rust, in `tests/`|`spec/` for Python/Ruby/JVM). Follow the language,
  not another language's habit.
- Mock only true externals — network, clock, randomness, filesystem. Never
  mock the unit under test. Prefer a fake implementation of your own port.
- Assert behavior, not implementation. Tests must survive a refactor.
- Deterministic: fixed clock, seeded randomness, no sleeps, no shared state.
- Depth and strategy: the testing reference of the `engineering-principles`
  skill.

## Sanity check

Run the coverage command and confirm both artifacts exist — the diff-coverage
gate and the ratchet both fail loudly without them. Record the report path in
the project's rules document so CI and future contributors agree on it.

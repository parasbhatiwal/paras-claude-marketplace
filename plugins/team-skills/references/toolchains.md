# Toolchains: the standard task interface and per-language detection

The team's gates (git hooks, CI, and every skill that runs a check) must work
on **any** language. They do that by depending on a small, stable set of task
names rather than on `npm`.

Never assume an ecosystem. Detect, then run.

## The standard task interface

Every project exposes these tasks. What they run is the project's business;
what they are called is the team's.

| Task | Meaning | Must exit non-zero on failure |
|---|---|---|
| `install` | Reproducible dependency install from a lockfile | yes |
| `format-check` | Formatting is correct (no writes) | yes |
| `lint` | Static analysis / style rules | yes |
| `typecheck` | Type analysis (no-op only for genuinely untyped stacks) | yes |
| `test` | Full test suite | yes |
| `test-coverage` | Full suite + coverage report in a CI-readable format | yes |
| `build` | Production build/compile (no-op where meaningless) | yes |
| `security` | Dependency vulnerability + secret scan | yes |

Two rules make this work:

1. **A task that cannot be run must not silently pass.** "No test runner
   found" is a failure, never a green.
2. **Exit codes are the contract.** No parsing of human-readable output.

## Resolution order

Any tool needing a task resolves it in this order, stopping at the first hit:

1. **`make <task>`** — if a `Makefile` exists and defines that target.
2. **`just <task>`** — if a `justfile` exists and defines that recipe.
3. **Native detection** — the ecosystem table below.
4. **Nothing found** — report it explicitly. For `test`, that blocks the
   commit; the project needs its testing bootstrap
   (`testing-bootstrap.md`, alongside this file).

A `Makefile`/`justfile` is the recommended way to make a polyglot repo (or a
monorepo with mixed stacks) uniform — see `examples/Makefile.template`. It is
never *required*: a plain single-language project works through detection.

## Detection by ecosystem

Detect by manifest file, in the project root or the nearest ancestor.

### JavaScript / TypeScript — `package.json`
- Package manager from the lockfile: `package-lock.json` → npm,
  `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun.
- `install`: `npm ci` (or `pnpm i --frozen-lockfile`, `yarn --immutable`)
- Tasks: the `scripts` entries `lint`, `typecheck`, `test`, `test:coverage`,
  `build`. Prefer the script over guessing the runner.
- Fallbacks: `vitest run` / `jest` / `node --test`; `tsc --noEmit`;
  `eslint .` / `biome check`; `prettier --check .` / `biome format`.
- Coverage: `--coverage` with reporters `json-summary` **and** `cobertura`.
- `security`: `npm audit --audit-level=high`

### Python — `pyproject.toml`, `setup.cfg`, `requirements*.txt`
- `install`: `uv sync` / `poetry install --sync` / `pip install -r …`
- `test`: `pytest` (config in `pyproject.toml`/`pytest.ini`/`tox.ini`)
- `test-coverage`: `pytest --cov --cov-report=xml --cov-report=term`
  (`coverage.xml` is Cobertura — exactly what the diff-coverage gate wants)
- `lint`/`format-check`: `ruff check .` / `ruff format --check .`
  (or flake8 + black)
- `typecheck`: `mypy .` or `pyright` — strict mode
- `security`: `pip-audit`

### Go — `go.mod`
- `install`: `go mod download` (and `go mod verify`)
- `test`: `go test ./...`
- `test-coverage`: `go test ./... -coverprofile=coverage.out` then
  `gocover-cobertura < coverage.out > coverage.xml`
- `lint`: `golangci-lint run`; `format-check`: `gofmt -l .` (must be empty)
- `typecheck`: `go build ./...` (the compiler is the typechecker)
- `security`: `govulncheck ./...`

### Rust — `Cargo.toml`
- `install`: `cargo fetch --locked`
- `test`: `cargo test --all-features`
- `test-coverage`: `cargo llvm-cov --cobertura --output-path coverage.xml`
- `lint`: `cargo clippy -- -D warnings`; `format-check`: `cargo fmt --check`
- `typecheck`: `cargo check --all-targets`
- `security`: `cargo audit`

### JVM — `pom.xml`, `build.gradle(.kts)`
- `install`: `mvn -B dependency:go-offline` / `gradle --offline dependencies`
- `test`: `mvn -B test` / `gradle test`
- Coverage: JaCoCo, with the XML report enabled (convertible to Cobertura)
- `lint`: Checkstyle/Spotbugs/detekt; `format-check`: Spotless/ktlint
- `security`: OWASP dependency-check / `gradle dependencyCheckAnalyze`

### .NET — `*.sln`, `*.csproj`
- `install`: `dotnet restore --locked-mode`
- `test`: `dotnet test`
- Coverage: `dotnet test /p:CollectCoverage=true
  /p:CoverletOutputFormat=cobertura`
- `format-check`: `dotnet format --verify-no-changes`
- `security`: `dotnet list package --vulnerable --include-transitive`

### Ruby — `Gemfile`
- `install`: `bundle install --deployment`
- `test`: `bundle exec rspec` (or `rake test`)
- Coverage: SimpleCov with the Cobertura formatter
- `lint`/`format-check`: `rubocop` / `rubocop --autocorrect --fail-level`
- `security`: `bundle audit`

### PHP — `composer.json`
- `install`: `composer install --no-interaction --prefer-dist`
- `test`: `vendor/bin/phpunit`; coverage: `--coverage-cobertura`
- `lint`: PHPStan/Psalm; `format-check`: `php-cs-fixer --dry-run`
- `security`: `composer audit`

### Others
- **Elixir** — `mix.exs`: `mix test`, `mix format --check-formatted`,
  `mix dialyzer`, `mix deps.audit`
- **Swift** — `Package.swift`: `swift test`, `swift-format lint`
- **Dart/Flutter** — `pubspec.yaml`: `dart test` / `flutter test --coverage`,
  `dart analyze`, `dart format --set-exit-if-changed`
- **C/C++** — `CMakeLists.txt`: `ctest`, `clang-tidy`, `clang-format --dry-run
  -Werror`
- **Shell** — `shellcheck`, `shfmt -d`
- **Infra** — Terraform: `terraform validate`, `tflint`, `tfsec`/`checkov`

## Monorepos and polyglot repos

- Detect **per package**, not per repo. Run the tasks of the packages the diff
  touches; run everything on the default branch.
- If the repo has a workspace tool (Nx, Turborepo, Bazel, Pants, Gradle
  multi-project, Cargo workspace), use it — it already knows the affected
  projects.
- A root `Makefile` that fans out to each package is the simplest thing that
  gives hooks and CI one entry point.

## Coverage formats

The diff-coverage gate needs **Cobertura XML** and the ratchet needs a total
percentage. Every ecosystem above can produce Cobertura; when one genuinely
cannot, the project must state that in its rules document and the gate falls
back to total coverage only — never to nothing.

## Test-file conventions (used by the TDD gate)

The commit gate needs to recognize a test file in any language:

```
*.test.*  *.spec.*  *_test.go  *_test.py  test_*.py  *Test.java  *Tests.cs
*_spec.rb  *Spec.scala  *_test.exs  tests/  test/  __tests__/  spec/
```

Keep this list and the hook's globs in sync — the hook is the enforcement.
